<script lang="ts">
	import { onMount } from 'svelte';

	export let videoUrl: string = '';
	export let onClose: () => void;

	interface VideoEffects {
		brightness: number;
		contrast: number;
		saturation: number;
		hue: number;
		blur: number;
		pixelate: number;
		grayscale: number;
		sepia: number;
		invert: number;
		opacity: number;
	}

	interface EffectControl {
		key: keyof VideoEffects;
		label: string;
		min: number;
		max: number;
		step: number;
		unit: string;
	}

	interface EffectCategory {
		id: string;
		title: string;
		controls: EffectControl[];
	}

	let videoElement: HTMLVideoElement;
	let canvasPreview: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D | null;
	let isPlaying = false;
	let isCapturing = false;
	let animationFrameId: number;
	let isVideoLoaded = false;
	let processedVideoUrl: string | null = null;

	let effects: VideoEffects = {
		brightness: 100,
		contrast: 100,
		saturation: 100,
		hue: 0,
		blur: 0,
		pixelate: 0,
		grayscale: 0,
		sepia: 0,
		invert: 0,
		opacity: 100
	};

	const effectCategories: EffectCategory[] = [
		{
			id: 'color',
			title: 'Color Adjustments',
			controls: [
				{ key: 'brightness', label: 'Brightness', min: 0, max: 200, step: 5, unit: '%' },
				{ key: 'contrast', label: 'Contrast', min: 0, max: 200, step: 5, unit: '%' },
				{ key: 'saturation', label: 'Saturation', min: 0, max: 200, step: 5, unit: '%' },
				{ key: 'hue', label: 'Hue Rotation', min: 0, max: 360, step: 5, unit: '°' },
				{ key: 'grayscale', label: 'Grayscale', min: 0, max: 100, step: 5, unit: '%' },
				{ key: 'sepia', label: 'Sepia', min: 0, max: 100, step: 5, unit: '%' },
				{ key: 'invert', label: 'Invert', min: 0, max: 100, step: 5, unit: '%' }
			]
		},
		{
			id: 'blur',
			title: 'Blur & Pixelation',
			controls: [
				{ key: 'blur', label: 'Blur', min: 0, max: 20, step: 0.5, unit: 'px' },
				{ key: 'pixelate', label: 'Pixelate', min: 0, max: 50, step: 1, unit: 'px' }
			]
		},
		{
			id: 'advanced',
			title: 'Advanced',
			controls: [{ key: 'opacity', label: 'Opacity', min: 0, max: 100, step: 5, unit: '%' }]
		}
	];

	onMount(() => {
		if (!videoUrl) return;

		videoElement = document.createElement('video');
		videoElement.crossOrigin = 'anonymous';
		videoElement.loop = true;
		videoElement.volume = 0.5;
		videoElement.muted = false;

		if (videoUrl.startsWith('data:')) {
			videoElement.src = videoUrl;
		} else if (videoUrl.startsWith('https://storage.googleapis.com')) {
			const proxyUrl = `/api/proxyVideo?url=${encodeURIComponent(videoUrl)}`;
			videoElement.src = proxyUrl;
		} else {
			videoElement.src = videoUrl;
		}

		if (canvasPreview) {
			ctx = canvasPreview.getContext('2d', { willReadFrequently: true });

			videoElement.addEventListener('loadedmetadata', () => {
				// Set canvas to match video dimensions for best quality
				canvasPreview.width = videoElement.videoWidth;
				canvasPreview.height = videoElement.videoHeight;

				isVideoLoaded = true;
				updatePreview();
				videoElement.play().catch((err) => console.error('Play error:', err));
			});

			videoElement.addEventListener('play', () => {
				isPlaying = true;
				animatePreview();
			});

			videoElement.addEventListener('pause', () => {
				isPlaying = false;
			});

			videoElement.addEventListener('error', (e) => {
				console.error('❌ Video load error:', e);
			});

			videoElement.play().catch((err) => console.error('Play error:', err));
		}

		return () => {
			if (videoElement) {
				videoElement.pause();
				videoElement.src = '';
			}
			if (animationFrameId) cancelAnimationFrame(animationFrameId);
			if (processedVideoUrl) URL.revokeObjectURL(processedVideoUrl);
		};
	});

	function animatePreview() {
		if (!ctx || !canvasPreview || !videoElement || !isPlaying) return;

		// Clear canvas
		ctx.clearRect(0, 0, canvasPreview.width, canvasPreview.height);

		// Apply filters directly to context for capture
		applyContextFilters();

		// Draw video frame with filters
		ctx.drawImage(videoElement, 0, 0, canvasPreview.width, canvasPreview.height);

		// Reset context filters
		ctx.filter = 'none';

		// Also apply CSS filters for preview opacity
		canvasPreview.style.opacity = `${effects.opacity / 100}`;

		animationFrameId = requestAnimationFrame(animatePreview);
	}

	function applyContextFilters() {
		if (!ctx) return;

		// Apply filters to the canvas context (this gets captured)
		ctx.filter = `
			brightness(${effects.brightness}%)
			contrast(${effects.contrast}%)
			saturate(${effects.saturation}%)
			hue-rotate(${effects.hue}deg)
			blur(${effects.blur}px)
			grayscale(${effects.grayscale}%)
			sepia(${effects.sepia}%)
			invert(${effects.invert}%)
			opacity(${effects.opacity}%)
		`;
	}

	function applyCanvasFilters() {
		if (!canvasPreview) return;

		// CSS filters for visual preview only (backup)
		const filterString = `
			brightness(${effects.brightness}%)
			contrast(${effects.contrast}%)
			saturate(${effects.saturation}%)
			hue-rotate(${effects.hue}deg)
			blur(${effects.blur}px)
			grayscale(${effects.grayscale}%)
			sepia(${effects.sepia}%)
			invert(${effects.invert}%)
		`;

		canvasPreview.style.filter = filterString;
		canvasPreview.style.opacity = `${effects.opacity / 100}`;
	}

	function updatePreview() {
		if (!ctx || !canvasPreview || !videoElement) return;

		ctx.clearRect(0, 0, canvasPreview.width, canvasPreview.height);
		applyContextFilters();
		ctx.drawImage(videoElement, 0, 0, canvasPreview.width, canvasPreview.height);
		ctx.filter = 'none';
		canvasPreview.style.opacity = `${effects.opacity / 100}`;
	}

	function resetEffects() {
		effects = {
			brightness: 100,
			contrast: 100,
			saturation: 100,
			hue: 0,
			blur: 0,
			pixelate: 0,
			grayscale: 0,
			sepia: 0,
			invert: 0,
			opacity: 100
		};
		updatePreview();
	}

	function exportEffects() {
		const effectsData = JSON.stringify(effects, null, 2);
		const blob = new Blob([effectsData], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `video-effects-${Date.now()}.json`;
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
	}

	async function captureVideo() {
		if (!videoElement || !canvasPreview) return;

		isCapturing = true;

		try {
			// Determine if we have a URL or need to upload the video
			let videoFile: Blob | null = null;
			let videoUrlToSend: string | null = null;

			if (videoUrl.startsWith('http') || videoUrl.startsWith('https://storage.googleapis.com')) {
				// Scenario A: Generated video with URL
				videoUrlToSend = videoUrl;
			} else if (videoUrl.startsWith('data:')) {
				// Scenario B: Uploaded video (base64)

				const response = await fetch(videoUrl);
				videoFile = await response.blob();
			} else {
				throw new Error('Invalid video source');
			}

			// Prepare form data
			const formData = new FormData();

			if (videoFile) {
				formData.append('videoFile', videoFile, 'video.webm');
			} else if (videoUrlToSend) {
				formData.append('videoUrl', videoUrlToSend);
			}

			formData.append('effects', JSON.stringify(effects));

			// Send to backend API

			const response = await fetch('/api/processVideoEffects', {
				method: 'POST',
				body: formData
			});

			const data = await response.json();

			if (!response.ok || data.error) {
				throw new Error(data.error || data.details || 'Processing failed');
			}

			// Convert base64 response to blob URL
			if (data.videoBase64) {
				const videoBlob = base64ToBlob(data.videoBase64, 'video/webm');
				if (processedVideoUrl) URL.revokeObjectURL(processedVideoUrl);
				processedVideoUrl = URL.createObjectURL(videoBlob);
			} else {
				throw new Error('No video data received from server');
			}
		} catch (err) {
			console.error('❌ Error processing video:', err);
			alert(`Failed to process video: ${err instanceof Error ? err.message : 'Unknown error'}`);
		} finally {
			isCapturing = false;
		}
	}

	function base64ToBlob(base64: string, mimeType: string): Blob {
		const byteCharacters = atob(base64);
		const byteArrays = [];

		for (let offset = 0; offset < byteCharacters.length; offset += 512) {
			const slice = byteCharacters.slice(offset, offset + 512);
			const byteNumbers = new Array(slice.length);

			for (let i = 0; i < slice.length; i++) {
				byteNumbers[i] = slice.charCodeAt(i);
			}

			const byteArray = new Uint8Array(byteNumbers);
			byteArrays.push(byteArray);
		}

		return new Blob(byteArrays, { type: mimeType });
	}

	function downloadProcessedVideo() {
		if (!processedVideoUrl) return;

		const a = document.createElement('a');
		a.href = processedVideoUrl;
		a.download = `edited-video-${Date.now()}.webm`;
		document.body.appendChild(a);
		a.click();
		a.remove();
	}

	function togglePlayPause() {
		if (!videoElement) return;
		if (isPlaying) {
			videoElement.pause();
		} else {
			videoElement.play();
		}
		isPlaying = !isPlaying;
	}

	$: (effects, updatePreview());
</script>

<!-- Fixed modal with proper scrolling -->
<div class="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/90 p-4">
	<div class="flex h-full w-full max-w-7xl flex-col gap-4 overflow-hidden lg:flex-row">
		<!-- Preview Section -->
		<div class="flex flex-1 flex-col gap-4 overflow-y-auto">
			<div class="flex items-center justify-between">
				<h2 class="text-2xl font-bold text-white">Video Effects</h2>
				<button
					on:click={onClose}
					class="btn btn-circle btn-ghost btn-sm"
					aria-label="Close effects panel"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			<!-- Canvas Preview -->
			<div class="relative flex-1 overflow-hidden rounded-lg bg-base-300">
				{#if !isVideoLoaded}
					<div
						class="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-lg"
					>
						<div class="flex flex-col items-center gap-4">
							<div class="loading loading-lg loading-spinner text-info"></div>
							<p class="text-center text-white">Loading video...</p>
						</div>
					</div>
				{/if}
				<div class="flex h-full w-full items-center justify-center p-6">
					<canvas bind:this={canvasPreview} class="max-h-full max-w-full rounded-lg object-contain"
					></canvas>
				</div>
				<!-- Play/Pause Button -->
				<button
					on:click={togglePlayPause}
					class="btn absolute bottom-4 left-4 btn-circle btn-sm btn-info"
					aria-label="Toggle play/pause"
					disabled={!isVideoLoaded}
				>
					{#if isPlaying}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-4 w-4"
							fill="currentColor"
							viewBox="0 0 24 24"
						>
							<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
						</svg>
					{:else}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-4 w-4"
							fill="currentColor"
							viewBox="0 0 24 24"
						>
							<path d="M8 5v14l11-7z" />
						</svg>
					{/if}
				</button>
			</div>

			<!-- Download Button for Processed Video -->
			{#if processedVideoUrl}
				<div class="rounded-lg border border-green-500/50 bg-green-900/30 p-4">
					<p class="mb-2 text-sm text-green-400">✅ Video captured successfully!</p>
					<button on:click={downloadProcessedVideo} class="btn w-full btn-sm btn-success">
						⬇️ Download Edited Video
					</button>
				</div>
			{/if}
		</div>

		<!-- Effects Controls Panel - FIXED SCROLLING -->
		<div class="flex w-full flex-col gap-3 overflow-y-auto lg:w-96">
			<!-- Scrollable Controls Container -->
			<div
				class="flex flex-col gap-2 overflow-y-auto pr-2"
				style="max-height: calc(100vh - 200px);"
			>
				{#each effectCategories as category}
					<div class="rounded-lg border border-white/10 bg-gray-800/50">
						<details class="group">
							<summary
								class="flex cursor-pointer items-center justify-between rounded-lg px-4 py-3 text-sm font-semibold text-white hover:bg-white/5"
							>
								<span>{category.title}</span>
								<svg
									viewBox="0 0 20 20"
									fill="currentColor"
									aria-hidden="true"
									class="size-5 flex-none text-gray-500 transition-transform group-open:rotate-180"
								>
									<path
										d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
										clip-rule="evenodd"
										fill-rule="evenodd"
									/>
								</svg>
							</summary>

							<div class="px-2 pb-2">
								{#each category.controls as control}
									<div class="rounded-lg p-3 hover:bg-white/5">
										<div class="mb-2 flex items-center justify-between">
											<span class="text-sm font-semibold text-white">
												{control.label}
											</span>
											<span class="text-xs text-gray-400">{effects[control.key]}{control.unit}</span
											>
										</div>
										<input
											type="range"
											min={control.min}
											max={control.max}
											step={control.step}
											bind:value={effects[control.key]}
											class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700 accent-blue-500"
										/>
										<input
											type="number"
											min={control.min}
											max={control.max}
											step={control.step}
											bind:value={effects[control.key]}
											class="mt-2 w-full rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white outline-none focus:border-white/20"
										/>
									</div>
								{/each}
							</div>
						</details>
					</div>
				{/each}
			</div>

			<!-- ACTION BUTTONS - Fixed at bottom -->
			<div class="mt-auto flex flex-col gap-2 border-t border-white/10 pt-4">
				<button
					on:click={resetEffects}
					class="rounded-lg border border-white/10 bg-gray-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-700/50 disabled:opacity-50"
					disabled={isCapturing}
				>
					🔄 Reset Effects
				</button>
				<button
					on:click={exportEffects}
					class="rounded-lg border border-white/10 bg-gray-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-700/50 disabled:opacity-50"
					disabled={isCapturing}
				>
					💾 Export Settings
				</button>
				<button
					on:click={captureVideo}
					class="rounded-lg border border-white/10 bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
					disabled={isCapturing || !isVideoLoaded}
				>
					{#if isCapturing}
						🎥 Capturing...
					{:else if processedVideoUrl}
						🎬 Re-Capture Video
					{:else}
						🎬 Capture & Process
					{/if}
				</button>
			</div>
		</div>
	</div>
</div>

<style>
	/* Custom scrollbar styling */
	::-webkit-scrollbar {
		width: 8px;
	}

	::-webkit-scrollbar-track {
		background: rgba(255, 255, 255, 0.05);
		border-radius: 4px;
	}

	::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.2);
		border-radius: 4px;
	}

	::-webkit-scrollbar-thumb:hover {
		background: rgba(255, 255, 255, 0.3);
	}

	/* Hide default details marker */
	summary::-webkit-details-marker {
		display: none;
	}
</style>
