<script lang="ts">
	import { authStore } from '$lib/stores/auth.store';
	import { getUserProfile, updateContentRetentionSettings } from '$lib/firebase/firestore';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { User } from '$lib/types/firestore';

	let userProfile = $state<User | null>(null);
	let loading = $state(true);
	let saving = $state(false);
	let successMessage = $state('');

	// Profile image upload
	let uploadingPhoto = $state(false);
	let photoError = $state('');
	let photoPreview = $state<string | null>(null);

	async function handlePhotoUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		photoError = '';
		photoPreview = URL.createObjectURL(file);

		uploadingPhoto = true;
		const fd = new FormData();
		fd.append('image', file);

		try {
			const res = await fetch('/api/uploadProfileImage', { method: 'POST', body: fd });
			const data = await res.json();
			if (!res.ok) { photoError = data.error || 'Upload failed'; photoPreview = null; return; }
			// Update local auth store user
			authStore.updatePhotoURL(data.photoURL);
		} catch {
			photoError = 'Upload failed. Please try again.';
			photoPreview = null;
		} finally {
			uploadingPhoto = false;
		}
	}

	// Form state
	let autoDelete = $state(false);
	let deletionPeriod = $state<30 | 60 | 90>(30);
	let deleteVideosOnly = $state(false);
	let warnBeforeDelete = $state(true);

	onMount(async () => {
		if ($authStore.user) {
			userProfile = await getUserProfile($authStore.user.uid);
			if (userProfile) {
				// Load existing settings
				autoDelete = userProfile.contentRetention.autoDelete;
				deletionPeriod = userProfile.contentRetention.deletionPeriod || 30;
				deleteVideosOnly = userProfile.contentRetention.deleteVideosOnly;
				warnBeforeDelete = userProfile.contentRetention.warnBeforeDelete;
			}
		}
		loading = false;
	});

	async function saveSettings() {
		if (!$authStore.user) return;

		saving = true;
		successMessage = '';

		try {
			await updateContentRetentionSettings($authStore.user.uid, {
				autoDelete,
				deletionPeriod: autoDelete ? deletionPeriod : null,
				deleteVideosOnly,
				warnBeforeDelete,
				lastWarningAt: null
			});

			successMessage = 'Settings saved successfully!';
			setTimeout(() => {
				successMessage = '';
			}, 3000);
		} catch (error) {
			console.error('Error saving settings:', error);
			alert('Failed to save settings');
		} finally {
			saving = false;
		}
	}
</script>

<div class="mx-auto max-w-4xl">
	<h1 class="mb-6 text-3xl font-bold">Settings</h1>

	{#if loading}
		<div class="flex justify-center p-8">
			<span class="loading loading-lg loading-spinner"></span>
		</div>
	{:else if !$authStore.user}
		<div class="alert alert-warning">
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
					d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
				/>
			</svg>
			<span>Please sign in to access settings</span>
		</div>
	{:else}
		<!-- Account Info -->
		<div class="card mb-6 bg-base-200 shadow-xl">
			<div class="card-body">
				<h2 class="card-title">Account Information</h2>
				<div class="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
					<!-- Avatar with upload overlay -->
					<label class="group relative cursor-pointer">
						<div class="h-20 w-20 overflow-hidden rounded-full border-2 border-base-300">
							{#if photoPreview || $authStore.user.photoURL}
								<img
									src={photoPreview ?? $authStore.user.photoURL ?? ''}
									alt="Profile"
									class="h-full w-full object-cover"
								/>
							{:else}
								<div class="flex h-full w-full items-center justify-center bg-base-300 text-2xl font-bold">
									{($authStore.user.displayName || $authStore.user.email || 'U')[0].toUpperCase()}
								</div>
							{/if}
							<!-- Hover overlay -->
							<div class="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
								{#if uploadingPhoto}
									<span class="loading loading-spinner loading-sm text-white"></span>
								{:else}
									<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-6">
										<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
										<circle cx="12" cy="13" r="4"/>
									</svg>
								{/if}
							</div>
						</div>
						<input
							type="file"
							accept="image/jpeg,image/png,image/webp,image/gif"
							class="hidden"
							onchange={handlePhotoUpload}
							disabled={uploadingPhoto}
						/>
					</label>

					<div>
						<p class="text-lg font-bold">{$authStore.user.displayName || 'User'}</p>
						<p class="opacity-70">{$authStore.user.email}</p>
						{#if userProfile}
							<p class="mt-1 text-sm opacity-60">
								Plan: <span class="badge badge-primary">{userProfile.plan}</span>
								{#if userProfile.isAdmin}
									<button
										onclick={() => goto('/admin')}
										class="badge badge-outline badge-ghost ml-1 opacity-50 transition-opacity hover:opacity-100"
										title="Open admin panel"
									>
										Admin
									</button>
								{/if}
							</p>
						{/if}
						{#if photoError}
							<p class="mt-1 text-xs text-error">{photoError}</p>
						{/if}
						<p class="mt-1 text-xs opacity-40">Click avatar to change photo</p>
					</div>
				</div>

				{#if userProfile}
					<div class="stats mt-4 stats-vertical shadow lg:stats-horizontal">
						<div class="stat">
							<div class="stat-title">Images Generated</div>
							<div class="stat-value text-primary">{userProfile.imagesGenerated}</div>
						</div>
						<div class="stat">
							<div class="stat-title">Videos Generated</div>
							<div class="stat-value text-secondary">{userProfile.videosGenerated}</div>
						</div>
						<div class="stat">
							<div class="stat-title">Posts Published</div>
							<div class="stat-value text-accent">{userProfile.postsPublished}</div>
						</div>
					</div>

					<div class="mt-4">
						<p class="text-sm opacity-70">
							Storage: {(userProfile.storageUsed / 1024 / 1024).toFixed(2)} MB / {(
								userProfile.storageLimit /
								1024 /
								1024 /
								1024
							).toFixed(0)} GB
						</p>
						<progress
							class="progress mt-2 w-full progress-primary"
							value={userProfile.storageUsed}
							max={userProfile.storageLimit}
						></progress>
					</div>
				{/if}
			</div>
		</div>

		<!-- Content Retention Settings -->
		<div class="card bg-base-200 shadow-xl">
			<div class="card-body">
				<h2 class="card-title">Content Auto-Delete</h2>
				<p class="mb-4 text-sm opacity-70">
					Automatically delete old content to save storage space
				</p>

				{#if successMessage}
					<div class="mb-4 alert alert-success">
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
								d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<span>{successMessage}</span>
					</div>
				{/if}

				<div class="form-control">
					<label class="label cursor-pointer justify-start gap-4">
						<input type="checkbox" class="toggle toggle-primary" bind:checked={autoDelete} />
						<span class="label-text">Enable auto-delete</span>
					</label>
				</div>

				{#if autoDelete}
					<div class="mt-4 ml-8 space-y-4">
						<div class="form-control">
							<label class="label">
								<span class="label-text">Delete content after:</span>
							</label>
							<select class="select-bordered select w-full max-w-xs" bind:value={deletionPeriod}>
								<option value={30}>30 days</option>
								<option value={60}>60 days</option>
								<option value={90}>90 days</option>
							</select>
						</div>

						<div class="form-control">
							<label class="label cursor-pointer justify-start gap-4">
								<input
									type="checkbox"
									class="checkbox checkbox-primary"
									bind:checked={warnBeforeDelete}
								/>
								<span class="label-text">Warn me 7 days before deletion</span>
							</label>
						</div>

						<div class="form-control">
							<label class="label cursor-pointer justify-start gap-4">
								<input
									type="checkbox"
									class="checkbox checkbox-primary"
									bind:checked={deleteVideosOnly}
								/>
								<span class="label-text">Only auto-delete videos (keep images)</span>
							</label>
							<label class="label">
								<span class="label-text-alt opacity-60"
									>Videos take up more storage space than images</span
								>
							</label>
						</div>

						<div class="alert">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								class="h-6 w-6 shrink-0 stroke-info"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								></path>
							</svg>
							<span class="text-sm">
								<strong>Note:</strong> Pinned content and content actively posted to social media will
								never be auto-deleted.
							</span>
						</div>
					</div>
				{/if}

				<div class="mt-6 card-actions justify-end">
					<button class="btn btn-primary" onclick={saveSettings} disabled={saving}>
						{#if saving}
							<span class="loading loading-spinner"></span>
							Saving...
						{:else}
							Save Settings
						{/if}
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
