<script lang="ts">
	import { page } from '$app/stores';
	import { authStore } from '$lib/stores/auth.store';
	import logo from '$lib/assets/logo.png';
	import AuthModal from '$lib/components/AuthModal.svelte';
	import UserMenu from '$lib/components/UserMenu.svelte';
	import { resolve } from '$app/paths';
	let { children } = $props();
	let showAuthModal = $state(false);

	function closeSidebar() {
    const drawer = document.getElementById('my-drawer-4') as HTMLInputElement;
    if (drawer) drawer.checked = false;
}
</script>

<div class="drawer lg:drawer-open">
	<input id="my-drawer-4" type="checkbox" class="drawer-toggle" />
	<div class="drawer-content">
		<!-- Navbar -->
		<nav class="navbar w-full bg-base-300">
					

			<label for="my-drawer-4" aria-label="open sidebar" class="btn btn-ghost flex items-center gap-2 lg:hidden">
				<!-- Hamburger / menu icon — bigger and labeled on mobile -->
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="size-6"
				>
					<line x1="3" y1="6" x2="21" y2="6" />
					<line x1="3" y1="12" x2="21" y2="12" />
					<line x1="3" y1="18" x2="21" y2="18" />
				</svg>
				<span class="text-sm font-semibold tracking-wide">Menu</span>
</label>

			<div class="ml-3 flex items-center gap-2">
				<img src={logo} alt="Content Factory Logo" class="h-8 w-auto sm:h-10" />
				<span class="hidden sm:block text-base font-semibold lg:text-lg">
					Content Factory
				</span>
			</div>

			<!-- Auth buttons: Show login/signup if not logged in, show UserMenu if logged in -->
			{#if $authStore.loading}
				<div class="ml-auto">
					<span class="loading loading-sm loading-spinner"></span>
				</div>
			{:else if $authStore.user}
				<div class="ml-auto">
					<UserMenu />
				</div>
			{:else}
				<button
					class="btn ml-auto max-h-9 btn-outline lg:inline-flex"
					onclick={() => (showAuthModal = true)}
				>
					Login
				</button>
				<button
					class="btn ml-2 max-h-9 btn-outline lg:inline-flex"
					onclick={() => (showAuthModal = true)}
				>
					Sign Up
				</button>
			{/if}
		</nav>
		<!-- Page content here -->
		<div class="p-4">
			{@render children()}
		</div>
	</div>

	<div class="drawer-side is-drawer-close:overflow-visible">
		<label for="my-drawer-4" aria-label="close sidebar" class="drawer-overlay"></label>
		<div
			class="flex min-h-full flex-col items-start bg-base-200 is-drawer-close:w-14 is-drawer-open:w-64"
		>
			<!-- Sidebar content here -->
			<ul class="menu w-full grow">
				<!-- Homepage -->
				<li>
					<a
						href={resolve("/")}
						class="is-drawer-close:tooltip is-drawer-close:tooltip-right {$page.url.pathname === '/'
							? 'active'
							: ''}"
						data-tip="Homepage"
						onclick={closeSidebar}
					>
						<!-- Home icon -->
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							stroke-linejoin="round"
							stroke-linecap="round"
							stroke-width="2"
							fill="none"
							stroke="currentColor"
							class="my-1.5 inline-block size-4"
							><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"></path><path
								d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
							></path></svg
						>
						<span class="is-drawer-close:hidden">Homepage</span>
					</a>
				</li>

				<!-- Create (consolidated image + video) -->
				<li>
					<a
						href={resolve("/create")}
						class="is-drawer-close:tooltip is-drawer-close:tooltip-right {$page.url.pathname === '/create' ||
						$page.url.pathname === '/texttoimage' ||
						$page.url.pathname === '/imageedit' ||
						$page.url.pathname === '/texttovideo'
							? 'active'
							: ''}"
						data-tip="Create — Image & Video"
						onclick={closeSidebar}
					>
						<!-- Sparkle / wand icon -->
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							stroke-linejoin="round"
							stroke-linecap="round"
							stroke-width="2"
							fill="none"
							stroke="currentColor"
							class="my-1.5 inline-block size-4"
						>
							<path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
						</svg>
						<span class="is-drawer-close:hidden">Create</span>
					</a>
				</li>

				<!-- Settings -->
				<li>
					<a
						href={resolve("/settings")}
						class="is-drawer-close:tooltip is-drawer-close:tooltip-right {$page.url.pathname ===
						'/settings'
							? 'active'
							: ''}"
						data-tip="Settings"
						onclick={closeSidebar}
					>
						<!-- Settings icon -->
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							stroke-linejoin="round"
							stroke-linecap="round"
							stroke-width="2"
							fill="none"
							stroke="currentColor"
							class="my-1.5 inline-block size-4"
							><circle cx="12" cy="12" r="3"></circle><path
								d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
							></path></svg
						>
						<span class="is-drawer-close:hidden">Settings</span>
					</a>
				</li>

				<li>
					<a
						href={resolve("/content-library")}
						class="is-drawer-close:tooltip is-drawer-close:tooltip-right {$page.url.pathname ===
						'/content-library'
							? 'active'
							: ''}"
						data-tip="Content Library"
						onclick={closeSidebar}
					>
						<!-- Content Library-->
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							stroke-linejoin="round"
							stroke-linecap="round"
							stroke-width="2"
							fill="none"
							stroke="currentColor"
							class="my-1.5 inline-block size-4"
							><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path
								d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"
							></path></svg
						>
						<span class="is-drawer-close:hidden">Content Library</span>
					</a>
				</li>
			</ul>
		</div>
	</div>
</div>

<!-- Auth Modal -->
<AuthModal bind:isOpen={showAuthModal} />
