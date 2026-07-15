// src/lib/utils/videoCapture.ts
// Deterministic frame capture — explicit render + gl.finish() per frame.
// Frame delivery is pluggable: the WebCodecs path hardware-encodes H.264 in the
// browser and uploads ONE small mp4 (VPS only stream-copies + muxes audio);
// the JPEG-batch path remains as the fallback for unsupported browsers.
// Reads audioSessionId from audioSessionStore and passes it to encodeFromBatches
// so the server can mux the preserved audio back into the final video.

import { get } from 'svelte/store';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { videoState } from '$lib/stores/video.store';
import { timelineStore } from '$lib/stores/timeline.store';
import { mediaBinStore } from '$lib/stores/mediaBin.store';
import { encodeJobStore } from '$lib/stores/encodeJob.store';
import { authStore } from '$lib/stores/auth.store';
import { audioSessionStore } from '$lib/stores/audioSession.store';
import { audioStudioStore } from '$lib/stores/audioStudio.store';

const BATCH_SIZE = 30;

// Where each rendered frame goes after gl.finish(). addFrame may apply
// backpressure (encoder queue / batch upload); finalize must not resolve
// until every frame is durably on the server.
interface CaptureSink {
	addFrame(frameIndex: number): Promise<void>;
	finalize(): Promise<void>;
	dispose(): void;
}

interface WebCodecsSinkOptions {
	sourceCanvas: HTMLCanvasElement;
	width: number; // even, output resolution
	height: number; // even, output resolution
	fps: number;
	duration: number; // timeline seconds — for baking video fades
	videoFadeIn: number;
	videoFadeOut: number;
	sessionId: string;
	progressCallback?: (progress: number, message: string) => void;
}

// Returns null when WebCodecs H.264 encoding isn't available — caller falls
// back to JPEG batches. Video fade in/out is baked into the pixels here
// because the server never re-encodes this stream (it can't run vf filters
// under -c:v copy).
async function createWebCodecsSink(opts: WebCodecsSinkOptions): Promise<CaptureSink | null> {
	if (typeof VideoEncoder === 'undefined') return null;

	const { width, height, fps } = opts;
	const bitrate = 8_000_000;
	// High → Main → Constrained Baseline, level 5.1 first for large canvases
	const candidates = ['avc1.640033', 'avc1.640028', 'avc1.4d0033', 'avc1.4d0028', 'avc1.42e028'];
	let codec: string | null = null;
	for (const c of candidates) {
		try {
			const support = await VideoEncoder.isConfigSupported({
				codec: c,
				width,
				height,
				bitrate,
				framerate: fps,
				avc: { format: 'avc' }
			});
			if (support.supported) {
				codec = c;
				break;
			}
		} catch {
			// malformed/unknown codec string on this browser — try the next
		}
	}
	if (!codec) return null;

	const muxer = new Muxer({
		target: new ArrayBufferTarget(),
		video: { codec: 'avc', width, height },
		fastStart: 'in-memory'
	});

	let encodeError: DOMException | null = null;
	const encoder = new VideoEncoder({
		output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
		error: (e) => {
			encodeError = e;
		}
	});
	encoder.configure({
		codec,
		width,
		height,
		bitrate,
		framerate: fps,
		avc: { format: 'avc' },
		latencyMode: 'quality'
	});

	console.log(`🎥 WebCodecs encoder active — ${codec} @ ${width}x${height}, in-browser H.264`);

	// Downscale from physical (DPR-scaled) pixels to output resolution here,
	// replacing the server-side scale filter.
	const outCanvas = document.createElement('canvas');
	outCanvas.width = width;
	outCanvas.height = height;
	const ctx = outCanvas.getContext('2d')!;

	const frameMicros = Math.round(1e6 / fps);
	const fadeOutStart = opts.duration - opts.videoFadeOut;

	return {
		async addFrame(i: number) {
			if (encodeError) throw encodeError;

			ctx.drawImage(opts.sourceCanvas, 0, 0, width, height);

			// Bake video fade to black (server applied fade= in Pass 1; there is no Pass 1 here)
			const T = i / fps;
			let black = 0;
			if (opts.videoFadeIn > 0 && T < opts.videoFadeIn) black = 1 - T / opts.videoFadeIn;
			if (opts.videoFadeOut > 0 && T >= fadeOutStart) {
				black = Math.max(black, Math.min(1, (T - fadeOutStart) / opts.videoFadeOut));
			}
			if (black > 0) {
				ctx.fillStyle = `rgba(0,0,0,${black.toFixed(4)})`;
				ctx.fillRect(0, 0, width, height);
			}

			const frame = new VideoFrame(outCanvas, {
				timestamp: Math.round((i * 1e6) / fps),
				duration: frameMicros
			});
			encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
			frame.close();

			// Backpressure — don't let the encode queue outrun the hardware encoder
			while (encoder.encodeQueueSize > 8) {
				await new Promise((r) => setTimeout(r, 4));
			}
		},

		async finalize() {
			if (encodeError) throw encodeError;
			opts.progressCallback?.(72, 'Finalizing video encode...');
			await encoder.flush();
			if (encodeError) throw encodeError;
			muxer.finalize();

			const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
			console.log(`📤 Uploading pre-encoded mp4 — ${(blob.size / 1048576).toFixed(2)}MB (single file)`);
			opts.progressCallback?.(80, 'Uploading video...');

			const formData = new FormData();
			formData.append('sessionId', opts.sessionId);
			formData.append('video', blob, 'capture.mp4');
			const response = await fetch('/api/uploadCapturedVideo', { method: 'POST', body: formData });
			console.log(`📤 Video upload response: ${response.status} ${response.ok ? '✅' : '❌'}`);
			if (!response.ok) {
				throw new Error(`Captured video upload failed with status ${response.status}`);
			}
		},

		dispose() {
			try {
				if (encoder.state !== 'closed') encoder.close();
			} catch {
				// already closed
			}
		}
	};
}

interface JpegSinkOptions {
	sourceCanvas: HTMLCanvasElement;
	width: number; // physical pixels — server downscales
	height: number;
	sessionId: string;
	totalFrames: number;
	progressCallback?: (progress: number, message: string) => void;
}

// Legacy path: JPEG per frame, batches of 30, each upload awaited before the
// next batch captures — slower than firing them in parallel, but a failed
// batch aborts the capture immediately instead of surfacing after the fact.
function createJpegSink(opts: JpegSinkOptions): CaptureSink {
	const totalBatches = Math.ceil(opts.totalFrames / BATCH_SIZE);

	// Single reusable 2D canvas for JPEG conversion — created once, reused per frame.
	// This avoids raw RGBA uploads (~88MB/batch) by compressing to JPEG (~3-5MB/batch).
	const jpegCanvas = document.createElement('canvas');
	jpegCanvas.width = opts.width;
	jpegCanvas.height = opts.height;
	const jpegCtx = jpegCanvas.getContext('2d')!;

	let batchFrames: Blob[] = [];
	let batchNumber = 0;
	let startFrame = 0;

	const flushBatch = async () => {
		const batchSizeKB = batchFrames.reduce((sum, b) => sum + b.size, 0) / 1024;
		console.log(
			`📤 Uploading batch ${batchNumber} of ${totalBatches - 1} — ${(batchSizeKB / 1024).toFixed(2)}MB (JPEG)`
		);
		opts.progressCallback?.(
			70 + (batchNumber / totalBatches) * 25,
			`Uploading batch ${batchNumber + 1} of ${totalBatches}...`
		);

		const formData = new FormData();
		formData.append('sessionId', opts.sessionId);
		formData.append('batchNumber', String(batchNumber));
		formData.append('startFrame', String(startFrame));
		formData.append('frameCount', String(batchFrames.length));
		// Each frame is a named JPEG entry — server writes them as frame-XXXXXX.jpg
		batchFrames.forEach((blob, idx) => {
			formData.append(`frame_${idx}`, blob, 'f.jpg');
		});

		const response = await fetch('/api/uploadFrameBatch', { method: 'POST', body: formData });
		console.log(`📤 Batch ${batchNumber} response: ${response.status} ${response.ok ? '✅' : '❌'}`);
		if (!response.ok)
			throw new Error(`Batch ${batchNumber} upload failed with status ${response.status}`);
		console.log(`✅ Batch ${batchNumber} confirmed saved`);

		startFrame += batchFrames.length;
		batchFrames = [];
		batchNumber++;
	};

	return {
		async addFrame() {
			// drawImage from a WebGL canvas (preserveDrawingBuffer: true) copies GPU-side,
			// already top-left oriented — replaces readPixels + CPU Y-flip, which stalled
			// the pipeline and allocated ~16MB of scratch buffers per frame.
			jpegCtx.drawImage(opts.sourceCanvas, 0, 0);
			const jpegBlob = await new Promise<Blob>((resolve) =>
				jpegCanvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.92)
			);
			batchFrames.push(jpegBlob);
			if (batchFrames.length >= BATCH_SIZE) await flushBatch();
		},

		async finalize() {
			if (batchFrames.length > 0) await flushBatch();
			console.log(`✅ All ${totalBatches} batches uploaded`);
		},

		dispose() {}
	};
}

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
	// Physical pixel dimensions — what the WebGL drawing buffer actually holds.
	const width = canvas.width;
	const height = canvas.height;
	// Logical (CSS) pixel dimensions — target output resolution.
	// On a 2× DPR display, canvas.width = clientWidth * 2. The WebCodecs path
	// down-scales in the browser; the JPEG path ships physical pixels and the
	// server down-scales, so the encoded video isn't 4× larger than display size.
	const outWidth = Math.floor(canvas.clientWidth / 2) * 2; // H.264 needs even dims
	const outHeight = Math.floor(canvas.clientHeight / 2) * 2;
	console.log(`🖼️ Canvas size: ${width}x${height}`);
	console.log(`🖼️ Canvas client size: ${canvas.clientWidth}x${canvas.clientHeight}`);
	const totalFrames = Math.ceil(timelineEnd * fps);

	// Read audioSessionId from store — will be null if video had no audio
	// or if extraction was skipped/failed. Server handles null gracefully.
	const audioSessionId = get(audioSessionStore);
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
		Math.abs(mainClips[0].sourceEnd - videoElement.duration) < 0.05 &&
		// Per-clip fades need the per-clip audio path — the legacy whole-file
		// mux can't apply them, so a faded "trivial" clip isn't trivial.
		!(mainClips[0].fadeIn || mainClips[0].fadeOut);

	let legacyAudioSessionId = audioSessionId;
	if (!mainTrivial && audioSessionId && !suppressOriginalAudio) {
		mainClips.forEach((c, i) => {
			// Clip fade (set in the Selected Clip panel) wins over the legacy
			// whole-video original-audio fade so audio matches the visual fade.
			const clipFadeIn = c.fadeIn ?? 0;
			const clipFadeOut = c.fadeOut ?? 0;
			clipAudios.push({
				sessionId: audioSessionId,
				timelineStart: c.startTime,
				sourceStart: c.sourceStart,
				duration: c.endTime - c.startTime,
				volume: 1,
				fadeIn: clipFadeIn > 0 ? clipFadeIn : (i === 0 ? audioStudio.originalFadeIn : 0),
				fadeOut: clipFadeOut > 0 ? clipFadeOut : (i === mainClips.length - 1 ? audioStudio.originalFadeOut : 0)
			});
		});
		legacyAudioSessionId = null;
	}

	// Secondary video clips — audio extracted when the clip was added (asset.sessionId).
	// Resolved per CLIP, not per track: lanes can host clips from mixed sources.
	const binAssets = get(mediaBinStore).assets;
	for (const tr of timeline.tracks) {
		if (tr.type !== 'video' || tr.muted) continue;
		for (const c of tr.clips) {
			if (c.assetId === mainAssetId) continue; // main audio handled above
			const asset = binAssets.find((a) => a.id === c.assetId);
			if (!asset?.sessionId || asset.type !== 'video') continue;
			clipAudios.push({
				sessionId: asset.sessionId,
				timelineStart: c.startTime,
				sourceStart: c.sourceStart,
				duration: c.endTime - c.startTime,
				volume: tr.volume ?? 1,
				// Per-clip fades so exported audio matches the baked visual fade
				fadeIn: c.fadeIn ?? 0,
				fadeOut: c.fadeOut ?? 0
			});
		}
	}

	// ── Music/voiceover clips — ALL timeline music tracks ────────────────
	// The legacy path exports only the single active musicSessionId; every other
	// music entry (second track, voiceover) played in preview but silently
	// vanished from the file. Describe every unmuted music clip and mix
	// server-side with trim + delay, exactly like clipAudios.
	const musicClips: ClipAudio[] = [];
	for (const tr of timeline.tracks) {
		if (tr.type !== 'music' || tr.muted || !tr.assetSessionId) continue;
		const entry = audioStudio.musicEntries[tr.assetSessionId];
		for (const c of tr.clips) {
			musicClips.push({
				sessionId: tr.assetSessionId,
				timelineStart: c.startTime,
				sourceStart: c.sourceStart,
				duration: c.endTime - c.startTime,
				volume: entry?.volume ?? 0.3,
				fadeIn: entry?.fadeIn ?? 0,
				fadeOut: entry?.fadeOut ?? 0
			});
		}
	}
	if (musicClips.length > 0) {
		console.log(`🎵 Exporting ${musicClips.length} music/voiceover clip(s) across all tracks`);
	}

	progressCallback?.(0, 'Starting capture...');

	videoElement.pause();
	(window as any).__threeJsCapturing = true;

	try {
		const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
		if (!gl) throw new Error('Failed to get WebGL context');

		const sessionId = Date.now().toString();

		// ── Deterministic frame preparation ─────────────────────────────────
		// Identical for both sinks: seek media to T = i/fps, publish the timeline
		// clock, composite, render, gl.finish(). Nothing here knows or cares how
		// the pixels leave the machine.
		const prepareFrame = async (i: number) => {
			const T = i / fps; // timeline time for this output frame

			// Seek the main video only where a main-track clip covers this moment —
			// the compositor's coverage check hides it elsewhere. Skip no-op seeks
			// (an unchanged currentTime never fires 'seeked'). Capture is offline, so
			// the timeout is generous — a seek that outruns it leaves the element with
			// readyState < 2, the compositor drops the layer, and the exported frame
			// blanks (seen as flicker when decode is slow, e.g. iGPU contention with
			// the WebCodecs hardware encoder).
			const srcT = mainSourceAt(T);
			if (srcT !== null && Math.abs(videoElement.currentTime - srcT) > 1 / (fps * 2)) {
				await new Promise<void>((resolve) => {
					const timeout = setTimeout(() => {
						console.warn(`⚠️ Main video seek to ${srcT.toFixed(2)}s timed out at frame ${i} — frame may render blank`);
						resolve();
					}, 5000);
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

			// All 3D text instances — video-textured letters need their GPU slot
			// marked dirty after the manual seek (multi-instance since 7-14-2026)
			const textMeshes: any[] =
				((window as any).__textMeshes as any[] | null) ?? [(window as any).__textMesh];
			for (const tm of textMeshes) {
				if (tm?._videoTexture) tm._videoTexture.needsUpdate = true;
			}

			const updateScene = (window as any).__threeJsUpdateScene;
			if (updateScene) updateScene(T);

			threeRenderer.render(threeScene, threeCamera);
			gl.finish();
		};

		const runCaptureLoop = async (sink: CaptureSink) => {
			for (let i = 0; i < totalFrames; i++) {
				await prepareFrame(i);
				await sink.addFrame(i);
				progressCallback?.((i / totalFrames) * 70, `Capturing frame ${i + 1}/${totalFrames}`);
			}
			await sink.finalize();
		};

		if (audioSessionId) {
			console.log(`🎵 Audio session attached — will mux audio-${audioSessionId}.aac after encode`);
		}

		// ── Capture: WebCodecs first, JPEG batches as fallback ──────────────
		let preEncoded = false;
		const webCodecsSink = await createWebCodecsSink({
			sourceCanvas: canvas,
			width: outWidth,
			height: outHeight,
			fps,
			duration: timelineEnd,
			videoFadeIn: audioStudio.videoFadeIn,
			videoFadeOut: audioStudio.videoFadeOut,
			sessionId,
			progressCallback
		});

		if (webCodecsSink) {
			console.log(`📹 Capturing ${totalFrames} frames at ${outWidth}x${outHeight} via WebCodecs`);
			try {
				await runCaptureLoop(webCodecsSink);
				preEncoded = true;
			} catch (wcError) {
				console.warn('⚠️ WebCodecs capture failed — falling back to JPEG batches:', wcError);
			} finally {
				webCodecsSink.dispose();
			}
		}

		if (!preEncoded) {
			const totalBatches = Math.ceil(totalFrames / BATCH_SIZE);
			console.log(
				`📹 Capturing ${totalFrames} frames at ${width}x${height} in ${totalBatches} batches of ${BATCH_SIZE}`
			);
			await runCaptureLoop(
				createJpegSink({ sourceCanvas: canvas, width, height, sessionId, totalFrames, progressCallback })
			);
		}

		console.log(`✅ Capture uploaded (${preEncoded ? 'pre-encoded mp4' : 'JPEG batches'}) — kicking off background encode...`);

		// Kick off background encode — returns immediately with jobId
		progressCallback?.(97, 'Starting background encode...');

		const userId = get(authStore).user?.uid;
		if (!userId) throw new Error('Not authenticated');

		const encodeResponse = await fetch('/api/encodeFromBatches', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				sessionId,
				preEncoded,
				totalFrames,
				fps,
				suppressOriginalAudio,
				// preEncoded: dims/scaling/fades already baked into the mp4 — server must not re-filter
				width: preEncoded ? outWidth : width,
				height: preEncoded ? outHeight : height,
				outWidth,
				outHeight,
				userId,
				audioSessionId: legacyAudioSessionId,
				clipAudios,
				musicClips,
				sfxSessionId: audioStudio.sfxSessionId,
				// musicClips supersedes the single-track legacy path — sending both would
				// mux the active music track twice
				musicSessionId: musicClips.length > 0 ? null : audioStudio.musicSessionId,
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
				videoFadeIn: preEncoded ? 0 : audioStudio.videoFadeIn,
				videoFadeOut: preEncoded ? 0 : audioStudio.videoFadeOut
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
