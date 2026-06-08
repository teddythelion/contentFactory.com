<script lang="ts">
	import { authStore } from '$lib/stores/auth.store';

	let { isOpen = $bindable(false) } = $props();

	let tab = $state<'signin' | 'signup' | 'reset'>('signin');
	let loading = $state(false);
	let error = $state<string | null>(null);
	let resetSent = $state(false);

	let email = $state('');
	let password = $state('');
	let displayName = $state('');
	let confirmPassword = $state('');

	function closeModal() {
		isOpen = false;
		error = null;
		resetSent = false;
		email = '';
		password = '';
		displayName = '';
		confirmPassword = '';
		tab = 'signin';
	}

	function switchTab(t: typeof tab) {
		tab = t;
		error = null;
		resetSent = false;
	}

	async function handleGoogleSignIn() {
		loading = true;
		error = null;
		const result = await authStore.signInWithGoogle();
		if (result.success) {
			closeModal();
		} else {
			error = result.error || 'Failed to sign in';
		}
		loading = false;
	}

	async function handleEmailSignIn() {
		if (!email || !password) { error = 'Please fill in all fields.'; return; }
		loading = true;
		error = null;
		const result = await authStore.signInWithEmail(email, password);
		if (result.success) {
			closeModal();
		} else {
			error = result.error || 'Failed to sign in';
		}
		loading = false;
	}

	async function handleEmailSignUp() {
		if (!displayName || !email || !password || !confirmPassword) { error = 'Please fill in all fields.'; return; }
		if (password !== confirmPassword) { error = 'Passwords do not match.'; return; }
		if (password.length < 6) { error = 'Password must be at least 6 characters.'; return; }
		loading = true;
		error = null;
		const result = await authStore.signUpWithEmail(email, password, displayName);
		if (result.success) {
			closeModal();
		} else {
			error = result.error || 'Failed to create account';
		}
		loading = false;
	}

	async function handlePasswordReset() {
		if (!email) { error = 'Enter your email address above.'; return; }
		loading = true;
		error = null;
		const result = await authStore.resetPassword(email);
		if (result.success) {
			resetSent = true;
		} else {
			error = result.error || 'Failed to send reset email';
		}
		loading = false;
	}
</script>

<dialog class="modal" class:modal-open={isOpen}>
	<div class="modal-box w-full max-w-sm">
		<h3 class="mb-1 text-xl font-bold">Welcome to Content Factory</h3>
		<p class="mb-5 text-sm opacity-60">Create stunning content in minutes</p>

		<!-- Tabs -->
		{#if tab !== 'reset'}
			<div role="tablist" class="tabs tabs-bordered mb-5 w-full">
				<button
					role="tab"
					class="tab flex-1 {tab === 'signin' ? 'tab-active' : ''}"
					onclick={() => switchTab('signin')}
				>
					Sign In
				</button>
				<button
					role="tab"
					class="tab flex-1 {tab === 'signup' ? 'tab-active' : ''}"
					onclick={() => switchTab('signup')}
				>
					Sign Up
				</button>
			</div>
		{/if}

		<!-- Error -->
		{#if error}
			<div class="alert alert-error mb-4 py-2 text-sm">
				<span>{error}</span>
			</div>
		{/if}

		<!-- Reset sent confirmation -->
		{#if resetSent}
			<div class="alert alert-success mb-4 py-2 text-sm">
				<span>Reset email sent! Check your inbox.</span>
			</div>
		{/if}

		<!-- Sign In -->
		{#if tab === 'signin'}
			<div class="flex flex-col gap-3">
				<input
					type="email"
					placeholder="Email"
					bind:value={email}
					class="input input-bordered w-full"
					onkeydown={(e) => e.key === 'Enter' && handleEmailSignIn()}
				/>
				<input
					type="password"
					placeholder="Password"
					bind:value={password}
					class="input input-bordered w-full"
					onkeydown={(e) => e.key === 'Enter' && handleEmailSignIn()}
				/>
				<button class="btn btn-primary w-full" onclick={handleEmailSignIn} disabled={loading}>
					{#if loading}<span class="loading loading-spinner loading-sm"></span>{/if}
					Sign In
				</button>
				<button
					class="btn-link text-xs opacity-60 hover:opacity-100"
					onclick={() => switchTab('reset')}
				>
					Forgot password?
				</button>

				<div class="divider text-xs opacity-40">or</div>

				<button class="btn btn-outline w-full" onclick={handleGoogleSignIn} disabled={loading}>
					<svg class="h-4 w-4" viewBox="0 0 24 24">
						<path fill="currentColor" d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,4.73 12.2,4.73C15.29,4.73 17.1,6.7 17.1,6.7L19,4.72C19,4.72 16.56,2 12.1,2C6.42,2 2.03,6.8 2.03,12C2.03,17.05 6.16,22 12.25,22C17.6,22 21.5,18.33 21.5,12.91C21.5,11.76 21.35,11.1 21.35,11.1V11.1Z"/>
					</svg>
					Continue with Google
				</button>
			</div>

		<!-- Sign Up -->
		{:else if tab === 'signup'}
			<div class="flex flex-col gap-3">
				<input
					type="text"
					placeholder="Display name"
					bind:value={displayName}
					class="input input-bordered w-full"
				/>
				<input
					type="email"
					placeholder="Email"
					bind:value={email}
					class="input input-bordered w-full"
				/>
				<input
					type="password"
					placeholder="Password (min 6 characters)"
					bind:value={password}
					class="input input-bordered w-full"
				/>
				<input
					type="password"
					placeholder="Confirm password"
					bind:value={confirmPassword}
					class="input input-bordered w-full"
					onkeydown={(e) => e.key === 'Enter' && handleEmailSignUp()}
				/>
				<button class="btn btn-primary w-full" onclick={handleEmailSignUp} disabled={loading}>
					{#if loading}<span class="loading loading-spinner loading-sm"></span>{/if}
					Create Account
				</button>

				<div class="divider text-xs opacity-40">or</div>

				<button class="btn btn-outline w-full" onclick={handleGoogleSignIn} disabled={loading}>
					<svg class="h-4 w-4" viewBox="0 0 24 24">
						<path fill="currentColor" d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,4.73 12.2,4.73C15.29,4.73 17.1,6.7 17.1,6.7L19,4.72C19,4.72 16.56,2 12.1,2C6.42,2 2.03,6.8 2.03,12C2.03,17.05 6.16,22 12.25,22C17.6,22 21.5,18.33 21.5,12.91C21.5,11.76 21.35,11.1 21.35,11.1V11.1Z"/>
					</svg>
					Continue with Google
				</button>
			</div>

		<!-- Password Reset -->
		{:else if tab === 'reset'}
			<div class="flex flex-col gap-3">
				<p class="text-sm opacity-70">Enter your email and we'll send a reset link.</p>
				<input
					type="email"
					placeholder="Email"
					bind:value={email}
					class="input input-bordered w-full"
					onkeydown={(e) => e.key === 'Enter' && handlePasswordReset()}
				/>
				<button class="btn btn-primary w-full" onclick={handlePasswordReset} disabled={loading || resetSent}>
					{#if loading}<span class="loading loading-spinner loading-sm"></span>{/if}
					Send Reset Email
				</button>
				<button class="btn-link text-xs opacity-60 hover:opacity-100" onclick={() => switchTab('signin')}>
					Back to Sign In
				</button>
			</div>
		{/if}

		<div class="modal-action mt-4">
			<button class="btn btn-ghost btn-sm" onclick={closeModal}>Cancel</button>
		</div>
	</div>
	<button class="modal-backdrop" aria-label="close modal" onclick={closeModal}></button>
</dialog>
