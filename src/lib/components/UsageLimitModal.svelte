<!-- src/lib/components/UsageLimitModal.svelte -->

<script lang="ts">
	import { subscriptionStore } from '$lib/stores/subscription.store';
	import type { UsageCheckResult } from '$lib/types/subscription';

	export let show: boolean = false;
	export let usageData: UsageCheckResult | null = null;
	export let generationType: 'image' | 'video' = 'image';

	function closeModal() {
		show = false;
	}

	async function handleUpgrade(plan: 'starter' | 'pro' | 'elite') {
		try {
			const response = await fetch('/api/stripe/checkout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ plan })
			});

			const data = await response.json();

			if (data.url) {
				window.location.href = data.url;
			} else {
				console.error('💸 Checkout returned no URL:', data);
				alert(`Could not start checkout: ${data.error ?? 'unknown error'}. Please try again.`);
			}
		} catch (error) {
			console.error('💸 Failed to start checkout:', error);
			alert('Could not start checkout — please try again.');
		}
	}
</script>

{#if show}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<!-- Backdrop -->
		<button
			class="absolute inset-0 bg-black/70 backdrop-blur-sm"
			on:click={closeModal}
			aria-label="Close modal"
		></button>

		<!-- Modal -->
		<div class="relative z-10 w-full max-w-md rounded-2xl bg-gray-900 border border-gray-700 p-6 shadow-2xl">
			<!-- Header -->
			<div class="text-center mb-6">
				<div class="text-4xl mb-3">🎨</div>
				<h2 class="text-xl font-bold text-white">
					You've hit your {generationType} limit
				</h2>
				<p class="text-gray-400 mt-2 text-sm leading-relaxed">
					You've used all your included {generationType} generations for this period.
					Each {generationType} we create uses premium AI models that cost real money to run.
					Upgrade to keep creating without interruption.
				</p>
			</div>

			<!-- Usage Display -->
			{#if usageData}
				<div class="bg-gray-800 rounded-xl p-4 mb-6">
					<div class="flex justify-between items-center mb-2">
						<span class="text-gray-400 text-sm">Images</span>
						<span class="text-white text-sm font-medium">
							{usageData.imagesUsed} / {usageData.imagesRemaining === -1 ? '∞' : usageData.imagesUsed + usageData.imagesRemaining}
						</span>
					</div>
					<div class="w-full bg-gray-700 rounded-full h-2 mb-4">
						<div
							class="bg-blue-500 h-2 rounded-full transition-all"
							style="width: {usageData.imagesRemaining === -1 ? 0 : (usageData.imagesUsed / (usageData.imagesUsed + usageData.imagesRemaining)) * 100}%"
						></div>
					</div>

					<div class="flex justify-between items-center mb-2">
						<span class="text-gray-400 text-sm">Videos</span>
						<span class="text-white text-sm font-medium">
							{usageData.videosUsed} / {usageData.videosRemaining === -1 ? '∞' : usageData.videosUsed + usageData.videosRemaining}
						</span>
					</div>
					<div class="w-full bg-gray-700 rounded-full h-2">
						<div
							class="bg-purple-500 h-2 rounded-full transition-all"
							style="width: {usageData.videosRemaining === -1 ? 0 : (usageData.videosUsed / (usageData.videosUsed + usageData.videosRemaining)) * 100}%"
						></div>
					</div>

					<p class="text-gray-500 text-xs mt-3 text-center">
						Resets at {usageData.resetAt}
					</p>
				</div>
			{/if}

			<!-- What you CAN still do -->
			<div class="bg-gray-800/50 rounded-xl p-4 mb-6">
				<p class="text-green-400 text-sm font-medium mb-2">You can still:</p>
				<ul class="text-gray-300 text-sm space-y-1">
					<li>✅ Use the 3D Enhancer on any image or video</li>
					<li>✅ Edit and download enhanced content</li>
					<li>✅ Access your saved library</li>
					<li>✅ Upload and enhance local files</li>
				</ul>
			</div>

			<!-- Upgrade Options — keep numbers in sync with TIER_CONFIG -->
			<div class="space-y-3">
				<button
					class="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-purple-600 hover:from-amber-400 hover:to-purple-500 text-white font-semibold transition-colors flex items-center justify-between ring-1 ring-amber-400/60"
					on:click={() => handleUpgrade('elite')}
				>
					<span class="text-left">Elite — 60 videos + 15 premium/extends, 100 images</span>
					<span class="text-amber-100 whitespace-nowrap pl-2">$256/mo</span>
				</button>

				<button
					class="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-colors flex items-center justify-between"
					on:click={() => handleUpgrade('pro')}
				>
					<span class="text-left">Pro — 25 videos + 4 premium/extends, 60 images</span>
					<span class="text-purple-200 whitespace-nowrap pl-2">$99/mo</span>
				</button>

				<button
					class="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors flex items-center justify-between"
					on:click={() => handleUpgrade('starter')}
				>
					<span class="text-left">Starter — 10 videos, 30 images</span>
					<span class="text-blue-200 whitespace-nowrap pl-2">$29/mo</span>
				</button>
			</div>

			<!-- Close -->
			<button
				class="w-full mt-4 py-2 text-gray-500 hover:text-gray-300 text-sm transition-colors"
				on:click={closeModal}
			>
				Maybe later
			</button>
		</div>
	</div>
{/if}