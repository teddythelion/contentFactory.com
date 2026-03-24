// src/lib/utils/videoCapture.ts
// FIXED: Deterministic frame capture — explicit render + gl.finish() per frame
// FIXED: Async job queue — encode fires in background, browser polls for completion
// UPDATED: Reads audioSessionId from audioSessionStore and passes it to encodeFromBatches
//          so the server can mux the preserved audio back into the final video.

import { get } from 'svelte/store';
import { videoState } from '$lib/stores/video.store';
import { encodeJobStore } from '$lib/stores/encodeJob.store';
import { authStore } from '$lib/stores/auth.store';
import { audioSessionStore } from '$lib/stores/audioSession.store'; // NEW
import { audioStudioStore } from '$lib/stores/audioStudio.store';

const BATCH_SIZE = 30;

export async function captureThreeJsVideo(
	progressCallback?: (progress: number, message: string) => void
): Promise<void> {
	const $videoState = get(videoState);

	if (!$videoState.videoUrl || !$videoState.isVideoLoaded) {
		throw new Error('Video not loaded');
	}

	const canvas = (window as any).__threeJsCanvas as HTMLCanvasElement;
	const videoElement = (window as any).__threeJsVideo as HTMLVideoElement;
	const threeRenderer = (window as any).__threeJsRenderer;
	const threeScene = (window as any).__threeJsScene;
	const threeCamera = (window as any).__threeJsCamera;

	if (!canvas || !videoElement) throw new Error('Canvas or video not found');
	if (!threeRenderer || !threeScene || !threeCamera) {
		throw new Error('Three.js renderer/scene/camera not found — cannot guarantee frame sync');
	}

	const videoDuration = videoElement.duration;
	const fps = 30;
	const width = canvas.width;
	const height = canvas.height;
	console.log(`🖼️ Canvas size: ${width}x${height}`);
	console.log(`🖼️ Canvas client size: ${canvas.clientWidth}x${canvas.clientHeight}`);
	const totalFrames = Math.ceil(videoDuration * fps);
	const totalBatches = Math.ceil(totalFrames / BATCH_SIZE);

	// Read audioSessionId from store — will be null if video had no audio
	// or if extraction was skipped/failed. Server handles null gracefully.
	const audioSessionId = get(audioSessionStore); // NEW
	const audioStudio = get(audioStudioStore);
	const suppressOriginalAudio =
		audioStudio.originalMuted ||
		audioStudio.sfxSuppressOriginal ||
		audioStudio.musicSuppressOriginal;
	progressCallback?.(0, 'Starting capture...');

	videoElement.pause();
	(window as any).__threeJsCapturing = true;

	try {
		const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
		if (!gl) throw new Error('Failed to get WebGL context');

		console.log(
			`📹 Capturing ${totalFrames} frames at ${width}x${height} in ${totalBatches} batches of ${BATCH_SIZE}`
		);
		if (audioSessionId) {
			console.log(`🎵 Audio session attached — will mux audio-${audioSessionId}.aac after encode`);
		}

		const sessionId = Date.now().toString();
		let batchNumber = 0;

		for (let startFrame = 0; startFrame < totalFrames; startFrame += BATCH_SIZE) {
			const endFrame = Math.min(startFrame + BATCH_SIZE, totalFrames);
			const batchFrames: Uint8Array[] = [];

			for (let i = startFrame; i < endFrame; i++) {
				const targetTime = i / fps;

				videoElement.currentTime = targetTime;

				await new Promise<void>((resolve) => {
					videoElement.addEventListener('seeked', () => resolve(), { once: true });
				});

				const textMesh = (window as any).__textMesh;
				if (textMesh?._videoTexture) {
					textMesh._videoTexture.needsUpdate = true;
				}

				const updateScene = (window as any).__threeJsUpdateScene;
				if (updateScene) updateScene(targetTime);

				threeRenderer.render(threeScene, threeCamera);
				gl.finish();

				const pixels = new Uint8Array(width * height * 4);
				gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

				const flipped = new Uint8Array(width * height * 4);
				for (let y = 0; y < height; y++) {
					const sourceRow = (height - 1 - y) * width * 4;
					const destRow = y * width * 4;
					flipped.set(pixels.subarray(sourceRow, sourceRow + width * 4), destRow);
				}

				batchFrames.push(flipped);

				const progress = (i / totalFrames) * 70;
				progressCallback?.(progress, `Capturing frame ${i + 1}/${totalFrames}`);
			}

			// Pack batch into single buffer
			const batchData = new Uint8Array(batchFrames.length * width * height * 4);
			let offset = 0;
			for (const frame of batchFrames) {
				batchData.set(frame, offset);
				offset += frame.length;
			}

			const batchSizeMB = (batchData.length / 1024 / 1024).toFixed(2);
			console.log(`📤 Uploading batch ${batchNumber} of ${totalBatches - 1} — ${batchSizeMB}MB`);

			progressCallback?.(
				70 + (batchNumber / totalBatches) * 25,
				`Uploading batch ${batchNumber + 1} of ${totalBatches}...`
			);

			const formData = new FormData();
			formData.append('sessionId', sessionId);
			formData.append('batchNumber', String(batchNumber));
			formData.append('startFrame', String(startFrame));
			formData.append('frameCount', String(batchFrames.length));
			formData.append('width', String(width));
			formData.append('height', String(height));
			formData.append('frameData', new Blob([batchData]), 'batch.raw');

			const response = await fetch('/api/uploadFrameBatch', {
				method: 'POST',
				body: formData
			});

			console.log(
				`📤 Batch ${batchNumber} response: ${response.status} ${response.ok ? '✅' : '❌'}`
			);

			if (!response.ok)
				throw new Error(`Batch ${batchNumber} upload failed with status ${response.status}`);

			console.log(`✅ Batch ${batchNumber} confirmed saved`);
			batchNumber++;
		}

		console.log(`✅ All ${totalBatches} batches uploaded — kicking off background encode...`);

		// Kick off background encode — returns immediately with jobId
		progressCallback?.(97, 'Starting background encode...');

		const userId = get(authStore).user?.uid;
		if (!userId) throw new Error('Not authenticated');

		const encodeResponse = await fetch('/api/encodeFromBatches', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				sessionId,
				totalFrames,
				fps,
				suppressOriginalAudio,
				width,
				height,
				userId,
				audioSessionId,
				sfxSessionId: audioStudio.sfxSessionId,
				musicSessionId: audioStudio.musicSessionId,
				sfxVolume: audioStudio.sfxVolume,
				musicVolume: audioStudio.musicVolume,
				sfxStartTime: audioStudio.sfxStartTime,
				sfxEndTime: audioStudio.sfxEndTime,
				sfxFadeIn: audioStudio.sfxFadeIn,
				sfxFadeOut: audioStudio.sfxFadeOut,
				musicStartTime: audioStudio.musicStartTime,
				musicEndTime: audioStudio.musicEndTime,
				musicFadeIn: audioStudio.musicFadeIn,
				musicFadeOut: audioStudio.musicFadeOut
			})
		});

		console.log(
			`🎬 Encode kickoff response: ${encodeResponse.status} ${encodeResponse.ok ? '✅' : '❌'}`
		);

		if (!encodeResponse.ok) {
			const error = await encodeResponse.json();
			throw new Error(error.details || 'Failed to start encode');
		}

		const { jobId } = await encodeResponse.json();
		console.log(`🎬 Encode job started — jobId: ${jobId}`);

		// Store jobId so the layout poller picks it up across page navigation
		encodeJobStore.set({ jobId, status: 'processing' });

		progressCallback?.(100, 'Encoding started!');
	} catch (error) {
		console.error('❌ Capture failed:', error);
		throw error;
	} finally {
		(window as any).__threeJsCapturing = false;
		videoElement.currentTime = 0;
		videoElement.play().catch(() => {});
	}
}
