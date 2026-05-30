<script lang="ts">
	import { authStore } from '$lib/stores/auth.store';
	import { goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	 let avatarError = $state(false);
	let dropdownOpen = $state(false);
	let dropdownRef: HTMLDivElement;

	function handleClickOutside(event: Event) {
		if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
			dropdownOpen = false;
		}
	}

	onMount(() => {
		document.addEventListener('click', handleClickOutside);
	});

	onDestroy(() => {
		document.removeEventListener('click', handleClickOutside);
	});

	async function handleSignOut() {
		const result = await authStore.signOut();
		if (result.success) {
			dropdownOpen = false;
			goto('/');
		}
	}

	function goToSettings() {
		dropdownOpen = false;
		goto('/settings');
	}
</script>

{#if $authStore.user}
	<div class="relative" bind:this={dropdownRef}>
		<button class="btn avatar btn-circle btn-ghost" onclick={() => (dropdownOpen = !dropdownOpen)}>
			<div class="w-10 rounded-full">
				{#if $authStore.user.photoURL && !avatarError}
					<img
						src={$authStore.user.photoURL}
						alt={$authStore.user.displayName || 'User'}
						referrerpolicy="no-referrer"
						onerror={() => (avatarError = true)}
					/>
				{:else}
					<div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary font-bold text-primary-content">
						{$authStore.user.displayName?.charAt(0) || $authStore.user.email?.charAt(0) || 'U'}
					</div>
				{/if}
			</div>
		</button>

		{#if dropdownOpen}
			<ul class="absolute right-0 top-full z-50 mt-3 w-52 rounded-box bg-base-200 p-2 shadow-lg menu menu-sm">
				<li class="menu-title">
					<span class="font-bold">{$authStore.user.displayName || 'User'}</span>
					<span class="text-xs opacity-60">{$authStore.user.email}</span>
				</li>
				<li>
					<button onclick={goToSettings}>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							stroke-linejoin="round"
							stroke-linecap="round"
							stroke-width="2"
							fill="none"
							stroke="currentColor"
							class="h-4 w-4"
						>
							<circle cx="12" cy="12" r="3"></circle>
							<path
								d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m4.92 4.92l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m4.92-4.92l4.24-4.24"
							></path>
						</svg>
						Settings
					</button>
				</li>
				<li>
					<button onclick={handleSignOut} class="text-error">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							stroke-linejoin="round"
							stroke-linecap="round"
							stroke-width="2"
							fill="none"
							stroke="currentColor"
							class="h-4 w-4"
						>
							<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
							<polyline points="16 17 21 12 16 7"></polyline>
							<line x1="21" y1="12" x2="9" y2="12"></line>
						</svg>
						Sign Out
					</button>
				</li>
			</ul>
		{/if}
	</div>
{/if}