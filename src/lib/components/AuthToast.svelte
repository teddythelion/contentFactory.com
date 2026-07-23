<!-- src/lib/components/AuthToast.svelte -->
<!-- Shared "sign in required" toast — bindable, self-contained (owns its own
     AuthModal). Auto-hides 6s after becoming visible. -->
<script lang="ts">
	import AuthModal from '$lib/components/AuthModal.svelte';

	let { visible = $bindable(false), message = 'You need to be signed in to use this tool.' } = $props();

	let showAuthModal = $state(false);
	let hideTimeout: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		if (hideTimeout) clearTimeout(hideTimeout);
		if (visible) {
			hideTimeout = setTimeout(() => { visible = false; }, 6000);
		}
	});
</script>

{#if visible}
	<div class="toast toast-top toast-center z-[9999]">
		<div class="alert alert-warning flex max-w-sm flex-col gap-2 shadow-2xl">
			<div class="flex items-center gap-2">
				<span class="text-2xl">🔒</span>
				<div>
					<p class="font-bold">Sign in required</p>
					<p class="text-sm">{message}</p>
				</div>
				<button onclick={() => (visible = false)} class="btn btn-ghost btn-xs ml-auto">✕</button>
			</div>
			<button
				onclick={() => { showAuthModal = true; visible = false; }}
				class="btn btn-primary btn-sm w-full"
			>
				Sign In Now
			</button>
		</div>
	</div>
{/if}

<AuthModal bind:isOpen={showAuthModal} />
