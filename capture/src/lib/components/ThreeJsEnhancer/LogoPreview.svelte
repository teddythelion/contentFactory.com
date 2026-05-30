<!-- src/lib/components/ThreeJsEnhancer/LogoPreview.svelte -->
<!-- Logo Preview Overlay - Shows logo on video preview in real-time -->

<script lang="ts">
	import { logoState } from '$lib/stores/logo.store';
	import { onMount, onDestroy } from 'svelte';

	// Get video element to track currentTime
	let videoElement: HTMLVideoElement | null = null;
	let currentTime = 0;
	let animationFrame: number;

	onMount(() => {
		// Get reference to the video element
		videoElement = (window as any).__threeJsVideo;

		// Update currentTime on every frame to handle timing
		function updateTime() {
			if (videoElement) {
				currentTime = videoElement.currentTime;
			}
			animationFrame = requestAnimationFrame(updateTime);
		}
		updateTime();

		return () => {
			cancelAnimationFrame(animationFrame);
		};
	});

	// Calculate if logo should be visible based on timing
	$: isVisible =
		$logoState.enabled &&
		$logoState.logoDataUrl &&
		currentTime >= $logoState.startTime &&
		currentTime <= $logoState.endTime;

	// Calculate fade opacity based on fade in/out timing
	$: fadeOpacity = (() => {
		if (!isVisible) return 0;

		const timeSinceStart = currentTime - $logoState.startTime;
		const timeUntilEnd = $logoState.endTime - currentTime;

		// Fade in
		if (timeSinceStart < $logoState.fadeInDuration) {
			return (timeSinceStart / $logoState.fadeInDuration) * $logoState.opacity;
		}

		// Fade out
		if (timeUntilEnd < $logoState.fadeOutDuration) {
			return (timeUntilEnd / $logoState.fadeOutDuration) * $logoState.opacity;
		}

		// Full opacity (not fading)
		return $logoState.opacity;
	})();

	// Convert position percentage to CSS
	$: positionStyle = `
		left: ${$logoState.position.x}%;
		top: ${$logoState.position.y}%;
		transform: translate(-50%, -50%) scale(${$logoState.scale});
		opacity: ${fadeOpacity};
	`;
</script>

{#if isVisible && $logoState.logoDataUrl}
	<div class="logo-preview" style={positionStyle}>
		<img src={$logoState.logoDataUrl} alt="Logo overlay" class="logo-image" />
	</div>
{/if}

<style>
	.logo-preview {
		position: absolute;
		pointer-events: none;
		z-index: 10;
		transition: opacity 0.1s ease-out;
	}

	.logo-image {
		min-width: 150px;
		min-height: 150px;
		max-width: 500px;
		max-height: 500px;
		width: auto;
		height: auto;
		object-fit: contain;
		display: block;
	}
</style>
