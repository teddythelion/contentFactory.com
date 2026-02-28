// src/lib/utils/videoCapture.ts
// FIXED: Deterministic frame capture — explicit render + gl.finish() per frame

import { get } from 'svelte/store';
import { videoState } from '$lib/stores/video.store';

const BATCH_SIZE = 30;

export async function captureThreeJsVideo(
	progressCallback?: (progress: number, message: string) => void
): Promise<string> {
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
	const totalFrames = Math.ceil(videoDuration * fps);

	progressCallback?.(0, 'Starting capture...');

	// FIX: Pause the video and stop the free-running animation loop before touching currentTime
	videoElement.pause();
	(window as any).__threeJsCapturing = true;

	try {
		const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
		if (!gl) throw new Error('Failed to get WebGL context');

		console.log(`📹 Capturing ${totalFrames} frames at ${width}x${height} in batches of ${BATCH_SIZE}`);

		const sessionId = Date.now().toString();
		let batchNumber = 0;

		for (let startFrame = 0; startFrame < totalFrames; startFrame += BATCH_SIZE) {
			const endFrame = Math.min(startFrame + BATCH_SIZE, totalFrames);
			const batchFrames: Uint8Array[] = [];

			for (let i = startFrame; i < endFrame; i++) {
				const targetTime = i / fps;

				// Seek to exact frame time
				videoElement.currentTime = targetTime;

				// FIX: Wait for the video element to finish seeking to targetTime
				await new Promise<void>((resolve) => {
					videoElement.addEventListener('seeked', () => resolve(), { once: true });
				});

				// FIX: Update video texture if present
				const textMesh = (window as any).__textMesh;
				if (textMesh?._videoTexture) {
					textMesh._videoTexture.needsUpdate = true;
				}

				// FIX: Advance all animations (logo, text, particles) to this frame's time
				// before rendering — these don't update automatically since animate() is paused
				const updateScene = (window as any).__threeJsUpdateScene;
				if (updateScene) updateScene(targetTime);

				// FIX: Explicitly drive one render at exactly this frame's time.
				threeRenderer.render(threeScene, threeCamera);

				// FIX: Flush the GPU command queue so readPixels gets THIS frame's pixels,
				// not whatever was last in the pipeline.
				gl.finish();

				// Now it's safe to read pixels
				const pixels = new Uint8Array(width * height * 4);
				gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

				// Flip vertically (WebGL origin is bottom-left, image origin is top-left)
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

			progressCallback?.(
				70 + (batchNumber / Math.ceil(totalFrames / BATCH_SIZE)) * 20,
				`Uploading batch ${batchNumber + 1}...`
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

			if (!response.ok) throw new Error('Batch upload failed');

			batchNumber++;
		}

		// Encode
		progressCallback?.(95, 'Encoding video...');

		const encodeResponse = await fetch('/api/encodeFromBatches', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ sessionId, totalFrames, fps, width, height })
		});

		if (!encodeResponse.ok) {
			const error = await encodeResponse.json();
			throw new Error(error.details || 'Encoding failed');
		}

		const result = await encodeResponse.json();

		// Convert base64 to blob
		const videoData = atob(result.videoBase64);
		const videoArray = new Uint8Array(videoData.length);
		for (let i = 0; i < videoData.length; i++) {
			videoArray[i] = videoData.charCodeAt(i);
		}
		const videoBlob = new Blob([videoArray], { type: 'video/mp4' });

		console.log(`📊 Final video: ${(videoBlob.size / 1024 / 1024).toFixed(2)} MB`);

		// Upload to GCS
		progressCallback?.(96, 'Uploading to cloud storage...');

		const uploadFormData = new FormData();
		uploadFormData.append('file', videoBlob, `enhanced-video-${sessionId}.mp4`);

		const uploadResponse = await fetch('/api/uploadEnhancedVideo', {
			method: 'POST',
			body: uploadFormData
		});

		if (!uploadResponse.ok) {
			const error = await uploadResponse.json();
			throw new Error(error.error || 'Failed to upload to cloud storage');
		}

		const uploadResult = await uploadResponse.json();
		const gcsUrl = uploadResult.publicUrl;
		const contentId = uploadResult.contentId;

		console.log(`☁️ Uploaded to GCS: ${gcsUrl}`);
		console.log(`📁 Content ID: ${contentId}`);

		videoState.setProcessedVideo(gcsUrl);

		// Download locally
		progressCallback?.(98, 'Preparing download...');
		const downloadUrl = URL.createObjectURL(videoBlob);
		const downloadLink = document.createElement('a');
		downloadLink.href = downloadUrl;
		downloadLink.download = `enhanced-video-${sessionId}.mp4`;
		document.body.appendChild(downloadLink);
		downloadLink.click();
		document.body.removeChild(downloadLink);
		setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

		progressCallback?.(100, 'Complete! Video downloaded and saved to cloud.');

		window.dispatchEvent(
			new CustomEvent('videoEnhanced', { detail: { gcsUrl, contentId, sessionId } })
		);

		return gcsUrl;

	} catch (error) {
		console.error('❌ Capture failed:', error);
		throw error;
	} finally {
		// FIX: Always restore normal playback and re-enable the animation loop,
		// even if capture threw an error midway through.
		(window as any).__threeJsCapturing = false;
		videoElement.currentTime = 0;
		videoElement.play().catch(() => {});
	}
}