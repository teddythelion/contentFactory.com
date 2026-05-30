<!-- src/lib/components/ThreeJsEnhancer/ThreeJsEnhancer.svelte -->
<!-- MAIN ORCHESTRATOR COMPONENT -->

<script lang="ts">
	import { onMount } from 'svelte';
	import { videoState } from '$lib/stores/video.store';
	import { threeJsState } from '$lib/stores/threeJs.store';
	import ThreeJsScene from './ThreeJsScene.svelte';
	import ControlsPanel from './ControlsPanel.svelte';		
	import { audioSessionStore } from '$lib/stores/audioSession.store';
	import { audioStudioStore } from '$lib/stores/audioStudio.store';
	
	export let videoUrl: string;
	export let onClose: () => void;
	export let audioSessionId: string | null = null;
	if (videoUrl) videoState.setVideo(videoUrl);

	$: if (videoUrl) {
		videoState.setVideo(videoUrl);
	} else {
		videoState.setError('No video URL provided');
	}

	$: videoError = $videoState.videoError;
	$: processedVideoUrl = $videoState.threeDVideoUrl;
	$: isCapturing = $threeJsState.isCapturing;

	// FIX: Use isSceneReady instead of isVideoLoaded for the spinner.
	// isVideoLoaded flips true as soon as the URL is set, but the Three.js
	// scene takes much longer to actually load the video and render.
	// isSceneReady only flips true when ThreeJsScene fires 'threeJsSceneReady'.
	let isSceneReady = false;

	function onSceneReady() {
		isSceneReady = true;
	}

	onMount(() => {
	// Write audioSessionId into the store so videoCapture.ts
	// can read it without prop drilling through ControlsPanel
	audioSessionStore.set(audioSessionId);

	window.addEventListener('threeJsSceneReady', onSceneReady);

	return () => {
		window.removeEventListener('threeJsSceneReady', onSceneReady);
		isSceneReady = false;
		// Clear the store when the enhancer closes
		// so it doesn't bleed into the next session
		audioSessionStore.clear();
		audioStudioStore.stopAll(); 
	};
	});

	type ModalView = 'enhance' | 'post';
	let currentView: ModalView = 'enhance';

	
	function downloadProcessedVideo() {
		if (!processedVideoUrl) return;
		const a = document.createElement('a');
		a.href = processedVideoUrl;
		a.download = `3d-video-${Date.now()}.webm`;
		document.body.appendChild(a);
		a.click();
		a.remove();
	}


	

	
</script>

{#if currentView === 'enhance'}
	<div class="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/90 p-0 lg:p-4">

		<!-- ── MOBILE LAYOUT (flex-col, full screen) ── -->
		<div class="flex h-full w-full flex-col lg:hidden">

			<!-- Mobile Header -->
			<div class="flex shrink-0 items-center justify-between px-4 py-2">
				<h2 class="text-lg font-bold text-white">Video Editor</h2>
				<button
					on:click={onClose}
					class="btn btn-circle btn-ghost btn-sm"
					aria-label="Close enhancer"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Mobile Video Preview — fixed 45% height, always visible -->
			<div class="relative shrink-0 overflow-hidden rounded-lg bg-base-300 mx-4" style="height: 45svh;">
				{#if videoError}
					<div class="absolute inset-0 flex items-center justify-center bg-red-900/50 backdrop-blur-lg">
						<p class="text-red-300">{videoError}</p>
					</div>
				{:else if !isSceneReady}
					<div class="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-lg">
						<div class="flex flex-col items-center gap-4">
							<div class="loading loading-lg loading-spinner text-info"></div>
							<p class="text-center text-white">Loading 3D scene...</p>
							<p class="text-center text-xs text-white/50">This may take a moment for large videos</p>
						</div>
					</div>
				{/if}
				<div class="relative h-full w-full">
					<ThreeJsScene />
				</div>
			</div>

			<!-- Mobile capture success banner — compact, non-intrusive -->
			{#if processedVideoUrl}
				<div class="mx-4 mt-2 shrink-0 rounded-lg border border-green-500/50 bg-green-900/30 px-3 py-2 flex items-center justify-between gap-2">
					<p class="text-xs text-green-400">✅ Video captured!</p>
					<button on:click={downloadProcessedVideo} class="btn btn-xs btn-success" disabled={isCapturing}>
						⬇️ Download
					</button>
				</div>
			{:else if isCapturing}
			<div class="mx-4 mt-2 shrink-0 rounded-lg border border-blue-500/50 bg-blue-900/30 px-3 py-2 space-y-1">
				<p class="text-xs text-blue-400 font-semibold">🎬 Professional encoding in progress...</p>
				<p class="text-[10px] text-gray-400">Typically takes 10-15 min • 20x faster than manual editing</p>
			</div>
			{/if}

			<!-- Mobile Controls Panel — takes remaining height, scrolls independently -->
			<div class="mt-2 min-h-0 flex-1">
				<ControlsPanel />
			</div>
		</div>

		<!-- ── DESKTOP LAYOUT (original, unchanged) ── -->
		<div class="hidden h-full w-full max-w-7xl flex-col gap-4 overflow-hidden lg:flex lg:flex-row">
			<!-- Preview Section (Left) -->
			<div class="flex flex-1 flex-col gap-4 overflow-y-auto">
				<div class="flex items-center justify-between">
					<h2 class="text-2xl font-bold text-white">Video Editor</h2>
					<button
						on:click={onClose}
						class="btn btn-circle btn-ghost btn-sm"
						aria-label="Close enhancer"
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<div
					class="relative flex-1 overflow-hidden rounded-lg bg-base-300"
					style="min-height: 0; aspect-ratio: 16/9;"
				>
					{#if videoError}
						<div class="absolute inset-0 flex items-center justify-center bg-red-900/50 backdrop-blur-lg">
							<p class="text-red-300">{videoError}</p>
						</div>
					{:else if !isSceneReady}
						<!-- FIX: Spinner stays visible until Three.js fires threeJsSceneReady,
						     not just until the URL is set in the store -->
						<div class="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-lg">
							<div class="flex flex-col items-center gap-4">
								<div class="loading loading-lg loading-spinner text-info"></div>
								<p class="text-center text-white">Loading 3D scene...</p>
								<p class="text-center text-xs text-white/50">This may take a moment for large videos</p>
							</div>
						</div>
					{/if}
					<div class="relative h-full w-full">
						<ThreeJsScene />
					</div>
				</div>

				{#if processedVideoUrl}
					<div class="rounded-lg border border-green-500/50 bg-green-900/30 p-4">
						<p class="mb-2 text-sm text-green-400">✅ Video captured successfully!</p>
						<button
							on:click={downloadProcessedVideo}
							class="btn w-full btn-sm btn-success"
							disabled={isCapturing}
						>
							⬇️ Download 3D Video
						</button>
					</div>
				{:else if isCapturing}
					<div class="rounded-lg border border-blue-500/50 bg-blue-900/30 p-4">
						<p class="mb-2 text-sm text-blue-400">🎬 Capturing video...</p>
					</div>
				{/if}
			</div>

			<!-- Controls Panel (Right) — desktop only -->
			<ControlsPanel />
		</div>

	</div>
{/if}

<style>
	::-webkit-scrollbar { width: 8px; }
	::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.05); border-radius: 4px; }
	::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 4px; }
	::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.3); }
</style>
