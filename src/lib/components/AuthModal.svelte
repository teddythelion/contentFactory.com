<script lang="ts">
	import { authStore } from '$lib/stores/auth.store';

	let { isOpen = $bindable(false) } = $props();
	let loading = $state(false);
	let error = $state<string | null>(null);

	async function handleGoogleSignIn() {
		loading = true;
		error = null;

		const result = await authStore.signInWithGoogle();

		if (result.success) {
			isOpen = false;
		} else {
			error = result.error || 'Failed to sign in';
		}

		loading = false;
	}

	function closeModal() {
		isOpen = false;
		error = null;
	}
</script>

<!-- Modal -->
<dialog class="modal" class:modal-open={isOpen}>
	<div class="modal-box">
		<h3 class="mb-4 text-2xl font-bold">Welcome to Content Factory</h3>
		<p class="mb-6 opacity-70">Sign in to start creating amazing content</p>

		{#if error}
			<div class="mb-4 alert alert-error">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-6 w-6 shrink-0 stroke-current"
					fill="none"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<span>{error}</span>
			</div>
		{/if}

		<button class="btn w-full btn-primary" onclick={handleGoogleSignIn} disabled={loading}>
			{#if loading}
				<span class="loading loading-spinner"></span>
				Signing in...
			{:else}
				<svg class="h-5 w-5" viewBox="0 0 24 24">
					<path
						fill="currentColor"
						d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,4.73 12.2,4.73C15.29,4.73 17.1,6.7 17.1,6.7L19,4.72C19,4.72 16.56,2 12.1,2C6.42,2 2.03,6.8 2.03,12C2.03,17.05 6.16,22 12.25,22C17.6,22 21.5,18.33 21.5,12.91C21.5,11.76 21.35,11.1 21.35,11.1V11.1Z"
					/>
				</svg>
				Sign in with Google
			{/if}
		</button>

		<div class="modal-action">
			<button class="btn btn-ghost" onclick={closeModal}>Cancel</button>
		</div>
	</div>
	<button class="modal-backdrop" aria-label="main model" onclick={closeModal}></button>
</dialog>
