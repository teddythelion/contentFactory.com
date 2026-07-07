// src/lib/utils/videoCapture.ts
// FIXED: Deterministic frame capture — explicit render + gl.finish() per frame
// FIXED: Async job queue — encode fires in background, browser polls for completion
// UPDATED: Reads audioSessionId from audioSessionStore and passes it to encodeFromBatches
//          so the server can mux the preserved audio back into the final video.

import { get } from 'svelte/store';
import { videoState } from '$lib/stores/video.store';
import { timelineStore } from '$lib/stores/timeline.store';
import { mediaBinStore } from '$lib/stores/mediaBin.store';
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

	// ── Timeline-aware export ────────────────────────────────────────────
	// The output walks TIMELINE time from 0 to the end of the last clip on any
	// track — not the main video's raw source duration — so trims, rearranged
	// clips, secondaries and images past the main video's end all land in the
	// file, and the export matches what preview plays.
	const timeline = get(timelineStore);
	let timelineEnd = 0;
	for (const tr of timeline.tracks)
		for (const c of tr.clips) timelineEnd = Math.max(timelineEnd, c.endTime);
	if (timelineEnd === 0) timelineEnd = videoElement.duration; // no timeline — raw video

	const mainAssetId = (window as any).__threeJsMainVideoAssetId as string | null;
	const mainTrack =
		timeline.tracks.find((t) => t.type === 'video' && t.assetId === mainAssetId) ??
		timeline.tracks.find((t) => t.type === 'video');
	const mainClips = mainTrack ? [...mainTrack.clips].sort((a, b) => a.startTime - b.startTime) : [];
	// Timeline moment → main-video source time (null = main video has no clip there)
	const mainSourceAt = (t: number): number | null => {
		const c = mainClips.find((k) => t >= k.startTime && t < k.endTime);
		return c ? c.sourceStart + (t - c.startTime) : null;
	};

	const fps = 30;
	// Physical pixel dimensions — what gl.readPixels actually reads.
	const width = canvas.width;
	const height = canvas.height;
	// Logical (CSS) pixel dimensions — target output resolution.
	// On a 2× DPR display, canvas.width = clientWidth * 2. We down-scale on the server
	// so the encoded video is at a sane resolution, not 4× larger than the display size.
	const outWidth = canvas.clientWidth;
	const outHeight = canvas.clientHeight;
	console.log(`🖼️ Canvas size: ${width}x${height}`);
	console.log(`🖼️ Canvas client size: ${canvas.clientWidth}x${canvas.clientHeight}`);
	const totalFrames = Math.ceil(timelineEnd * fps);
	const totalBatches = Math.ceil(totalFrames / BATCH_SIZE);

	// Read audioSessionId from store — will be null if video had no audio
	// or if extraction was skipped/failed. Server handles null gracefully.
	const audioSessionId = get(audioSessionStore); // NEW
	const audioStudio = get(audioStudioStore);
	const suppressOriginalAudio =
		audioStudio.originalMuted ||
		audioStudio.sfxSuppressOriginal ||
		audioStudio.musicSuppressOriginal;

	// ── Clip audio plan ──────────────────────────────────────────────────
	// Original audio takes the legacy whole-file path only for the trivial layout
	// (single untrimmed main clip at timeline 0). Anything else — moved/trimmed
	// main clips, secondary clips with extracted audio — is described per clip
	// and mixed server-side with trim + delay + volume.
	interface ClipAudio {
		sessionId: string; timelineStart: number; sourceStart: number;
		duration: number; volume: number; fadeIn: number; fadeOut: number;
	}
	const clipAudios: ClipAudio[] = [];

	const mainTrivial =
		mainClips.length === 1 &&
		Math.abs(mainClips[0].startTime) < 0.01 &&
		Math.abs(mainClips[0].sourceStart) < 0.01 &&
		Math.abs(mainClips[0].sourceEnd - videoElement.duration) < 0.05;

	let legacyAudioSessionId = audioSessionId;
	if (!mainTrivial && audioSessionId && !suppressOriginalAudio) {
		mainClips.forEach((c, i) => {
			clipAudios.push({
				sessionId: audioSessionId,
				timelineStart: c.startTime,
				sourceStart: c.sourceStart,
				duration: c.endTime - c.startTime,
				volume: 1,
				fadeIn: i === 0 ? audioStudio.originalFadeIn : 0,
				fadeOut: i === mainClips.length - 1 ? audioStudio.originalFadeOut : 0
			});
		});
		legacyAudioSessionId = null;
	}

	// Secondary video clips — audio extracted when the clip was added (asset.sessionId)
	const binAssets = get(mediaBinStore).assets;
	for (const tr of timeline.tracks) {
		if (tr.type !== 'video' || tr.assetId === mainAssetId || tr.muted) continue;
		const asset = binAssets.find((a) => a.id === tr.assetId);
		if (!asset?.sessionId || asset.type !== 'video') continue;
		for (const c of tr.clips) {
			clipAudios.push({
				sessionId: asset.sessionId,
				timelineStart: c.startTime,
				sourceStart: c.sourceStart,
				duration: c.endTime - c.startTime,
				volume: tr.volume ?? 1,
				fadeIn: 0,
				fadeOut: 0
			});
		}
	}

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

		// Single reusable 2D canvas for JPEG conversion — created once, reused per frame.
		// This avoids raw RGBA uploads (~88MB/batch) by compressing to JPEG (~3-5MB/batch).
		const jpegCanvas = document.createElement('canvas');
		jpegCanvas.width = width;
		jpegCanvas.height = height;
		const jpegCtx = jpegCanvas.getContext('2d')!;

		for (let startFrame = 0; startFrame < totalFrames; startFrame += BATCH_SIZE) {
			const endFrame = Math.min(startFrame + BATCH_SIZE, totalFrames);
			const batchFrames: Blob[] = [];

			for (let i = startFrame; i < endFrame; i++) {
				const T = i / fps; // timeline time for this output frame

				// Seek the main video only where a main-track clip covers this moment —
				// the compositor's coverage check hides it elsewhere. Skip no-op seeks
				// (an unchanged currentTime never fires 'seeked'); the timeout covers
				// stalled seeks so the capture can't hang.
				const srcT = mainSourceAt(T);
				if (srcT !== null && Math.abs(videoElement.currentTime - srcT) > 1 / (fps * 2)) {
					await new Promise<void>((resolve) => {
						const timeout = setTimeout(resolve, 1000);
						videoElement.addEventListener(
							'seeked',
							() => { clearTimeout(timeout); resolve(); },
							{ once: true }
						);
						videoElement.currentTime = srcT;
					});
				}

				// Publish the timeline clock — the compositor's layer selection and the
				// scene animations key off it (the editor's own publisher pauses during
				// capture so this value wins).
				(window as any).__timelineEditTime = T;

				// Bring secondary clips (split/PiP layouts) to the same time before compositing.
				const seekSecondaries = (window as any).__threeJsSeekSecondaries;
				if (seekSecondaries) await seekSecondaries(T);

				// Draw the current video frame into the composite canvas — animate() no-ops
				// during capture, so this is the only thing that gets the seeked frame onto
				// the CanvasTexture. It also sets needsUpdate on the texture.
				const drawComposite = (window as any).__threeJsDrawComposite;
				if (drawComposite) {
					drawComposite();
				} else {
					// Legacy VideoTexture path — force the GPU slot dirty after a manual seek.
					const mainVideoTexture = (window as any).__threeJsVideoTexture;
					if (mainVideoTexture) mainVideoTexture.needsUpdate = true;
				}

				const textMesh = (window as any).__textMesh;
				if (textMesh?._videoTexture) {
					textMesh._videoTexture.needsUpdate = true;
				}

				const updateScene = (window as any).__threeJsUpdateScene;
				if (updateScene) updateScene(T);

				threeRenderer.render(threeScene, threeCamera);
				gl.finish();

				// drawImage from a WebGL canvas (preserveDrawingBuffer: true) copies GPU-side,
				// already top-left oriented — replaces readPixels + CPU Y-flip, which stalled
				// the pipeline and allocated ~16MB of scratch buffers per frame.
				jpegCtx.drawImage(canvas, 0, 0);
				const jpegBlob = await new Promise<Blob>((resolve) =>
					jpegCanvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.92)
				);
				batchFrames.push(jpegBlob);

				const progress = (i / totalFrames) * 70;
				progressCallback?.(progress, `Capturing frame ${i + 1}/${totalFrames}`);
			}

			const batchSizeKB = batchFrames.reduce((sum, b) => sum + b.size, 0) / 1024;
			console.log(`📤 Uploading batch ${batchNumber} of ${totalBatches - 1} — ${(batchSizeKB / 1024).toFixed(2)}MB (JPEG)`);

			progressCallback?.(
				70 + (batchNumber / totalBatches) * 25,
				`Uploading batch ${batchNumber + 1} of ${totalBatches}...`
			);

			const formData = new FormData();
			formData.append('sessionId', sessionId);
			formData.append('batchNumber', String(batchNumber));
			formData.append('startFrame', String(startFrame));
			formData.append('frameCount', String(batchFrames.length));
			// Each frame is a named JPEG entry — server writes them as frame-XXXXXX.jpg
			batchFrames.forEach((blob, idx) => {
				formData.append(`frame_${idx}`, blob, 'f.jpg');
			});

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
				outWidth,
				outHeight,
				userId,
				audioSessionId: legacyAudioSessionId,
				clipAudios,
				sfxSessionId: audioStudio.sfxSessionId,
				musicSessionId: audioStudio.musicSessionId,
				sfxVolume: audioStudio.sfxVolume,
				musicVolume: audioStudio.musicVolume,
				sfxInstances: audioStudio.sfxInstances,
				sfxFadeIn: audioStudio.sfxFadeIn,
				sfxFadeOut: audioStudio.sfxFadeOut,
				musicStartTime: audioStudio.musicStartTime,
				musicEndTime: audioStudio.musicEndTime,
				musicFadeIn: audioStudio.musicFadeIn,
				musicFadeOut: audioStudio.musicFadeOut,
				originalFadeIn: audioStudio.originalFadeIn,
				originalFadeOut: audioStudio.originalFadeOut,
				videoFadeIn: audioStudio.videoFadeIn,
				videoFadeOut: audioStudio.videoFadeOut
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
