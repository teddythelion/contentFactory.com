<script lang="ts">
	import { onMount } from 'svelte';
	import { authStore } from '$lib/stores/auth.store';

	interface ContentItem {
		contentId: string;
		userId: string;
		type: 'image' | 'video' | 'audio';
		title: string;
		prompt: string;
		publicUrl: string;
		gcsPath: string;
		createdAt: any;
		fileSize: number;
		format: string;
		duration?: number;
		model?: string;
	}

	let activeTab: 'image' | 'video' | 'audio' = 'video'; // Videos first
	let items: ContentItem[] = [];
	let loading = false;
	let error: string | null = null;

	onMount(async () => {
		if ($authStore.user) {
			await loadContent($authStore.user.uid);
		}
	});

	async function loadContent(userId: string) {
		loading = true;
		error = null;

		try {
			const response = await fetch(`/api/content/list?userId=${userId}`);
			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to load content');
			}

			items = data.items || [];
		} catch (err: any) {
			error = err.message;
		} finally {
			loading = false;
		}
	}

	function formatDate(timestamp: any): string {
		if (!timestamp) return '';
		try {
			if (timestamp._seconds) {
				const date = new Date(timestamp._seconds * 1000);
				return date.toLocaleDateString();
			}
			const date = new Date(timestamp);
			return date.toLocaleDateString();
		} catch {
			return '';
		}
	}

	function formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
	}

	function downloadItem(item: ContentItem) {
		const knownExtensions = ['.mp4', '.jpg', '.png', '.mp3'];
		const hasExt = knownExtensions.some(ext => item.title.endsWith(ext));
		const fileName = hasExt ? item.title : `${item.title}.${item.format}`;

		// GCS signed URLs block browser-side fetch (CORS), route through server proxy instead
		const proxyUrl = `/api/proxyVideo?url=${encodeURIComponent(item.publicUrl)}&download=${encodeURIComponent(fileName)}`;
		const link = document.createElement('a');
		link.href = proxyUrl;
		link.download = fileName;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

	async function deleteItem(contentId: string) {
		if (!confirm('Delete this item?')) return;

		try {
			const response = await fetch(`/api/content/delete`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ contentId })
			});

			if (!response.ok) {
				throw new Error('Failed to delete');
			}

			items = items.filter((item) => item.contentId !== contentId);
		} catch (err: any) {
			error = err.message;
		}
	}

	function loadIntoEditor(item: ContentItem) {
		const params = new URLSearchParams({ edit: item.publicUrl, type: item.type });
		window.location.href = `/create?${params.toString()}`;
	}

	$: filteredItems = items.filter((item) => item.type === activeTab);
</script>

<div class="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
	<div class="mx-auto max-w-7xl">
		<!-- Header -->
		<div class="mb-8">
			<h1 class="mb-2 text-4xl font-bold text-white">📚 Content Library</h1>
			<p class="text-gray-400">Your saved images, videos, and generated audio</p>
		</div>

		<!-- Tabs — Videos first -->
		<div class="mb-8 flex gap-4 border-b border-white/10">
			<button
				on:click={() => (activeTab = 'video')}
				class={`px-4 pb-3 font-semibold transition-colors ${
					activeTab === 'video'
						? 'border-b-2 border-blue-400 text-blue-400'
						: 'text-gray-400 hover:text-white'
				}`}
			>
				🎬 Videos ({items.filter((i) => i.type === 'video').length})
			</button>
			<button
				on:click={() => (activeTab = 'image')}
				class={`px-4 pb-3 font-semibold transition-colors ${
					activeTab === 'image'
						? 'border-b-2 border-blue-400 text-blue-400'
						: 'text-gray-400 hover:text-white'
				}`}
			>
				📸 Images ({items.filter((i) => i.type === 'image').length})
			</button>
			<button
				on:click={() => (activeTab = 'audio')}
				class={`px-4 pb-3 font-semibold transition-colors ${
					activeTab === 'audio'
						? 'border-b-2 border-purple-400 text-purple-400'
						: 'text-gray-400 hover:text-white'
				}`}
			>
				🎵 Audio ({items.filter((i) => i.type === 'audio').length})
			</button>
		</div>

		<!-- Loading State -->
		{#if loading}
			<div class="flex justify-center py-12">
				<div class="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-400"></div>
			</div>
		{/if}

		<!-- Error State -->
		{#if error}
			<div class="mb-6 rounded-lg border border-red-500 bg-red-500/20 p-4 text-red-200">
				{error}
			</div>
		{/if}

		<!-- Empty State -->
		{#if filteredItems.length === 0 && !loading}
			<div class="py-16 text-center">
				<div class="mb-4 text-6xl">{activeTab === 'image' ? '📸' : activeTab === 'audio' ? '🎵' : '🎬'}</div>
				<h2 class="mb-2 text-2xl font-bold text-white">
					{activeTab === 'image' ? 'No images yet' : activeTab === 'audio' ? 'No audio yet' : 'No videos yet'}
				</h2>
				<p class="mb-6 text-gray-400">
					{activeTab === 'image'
						? 'Generate and save images to see them here'
						: activeTab === 'audio'
						? 'Generate music or SFX in the editor — they save here automatically'
						: 'Capture and save videos to see them here'}
				</p>
				{#if activeTab !== 'audio'}
				<a
					href={activeTab === 'image' ? '/texttoimage' : '/texttovideo'}
					class="inline-block rounded-lg bg-blue-600 px-6 py-2 text-white transition-colors hover:bg-blue-700"
				>
					{activeTab === 'image' ? '→ Create Image' : '→ Create Video'}
				</a>
				{/if}
			</div>
		{/if}

		<!-- Grid -->
		{#if filteredItems.length > 0}
			<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
				{#each filteredItems as item (item.contentId)}
					<div
						class="group overflow-hidden rounded-lg border border-white/10 bg-gray-800/50 transition-all hover:border-white/20"
					>
						<!-- Thumbnail / Player -->
						{#if item.type === 'audio'}
							<div class="flex h-36 w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-purple-900/60 to-gray-900 px-4">
								<div class="text-5xl">🎵</div>
								<audio src={item.publicUrl} controls class="w-full" style="height:32px;"></audio>
							</div>
						{:else}
						<div class="relative h-48 w-full overflow-hidden bg-gray-900">
							{#if item.type === 'image'}
								<img
									src={item.publicUrl}
									alt={item.title}
									class="h-full w-full object-cover transition-transform group-hover:scale-105"
									style="object-position: center 35%;"
								/>
							{:else}
								<video
									src={item.publicUrl}
									class="h-full w-full object-cover"
									style="object-position: center 35%;"
									controls={false}
									muted
 									playsinline
								>
								 <track kind="captions" />
							</video>
								<div
									class="absolute inset-0 flex items-center justify-center bg-black/30 transition-colors group-hover:bg-black/40"
								>
									<div class="text-4xl">▶️</div>
								</div>
							{/if}
						</div>
						{/if}

						<!-- Info -->
						<div class="p-4">
							<h3 class="mb-1 truncate font-semibold text-white">{item.title}</h3>
							<p class="mb-3 line-clamp-2 text-sm text-gray-400">{item.prompt}</p>

							<div class="mb-4 flex items-center justify-between text-xs text-gray-500">
								<span>{formatDate(item.createdAt)}</span>
								<span>{formatFileSize(item.fileSize)}</span>
							</div>

							<!-- Buttons -->
							<div class="flex gap-2">
								<button
									on:click={() => downloadItem(item)}
									class="flex-1 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
									title="Download"
								>
									Download ⬇️
								</button>
								{#if item.type !== 'audio'}
								<button
									on:click={() => loadIntoEditor(item)}
									class="flex-1 rounded bg-gray-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-600"
									title="Load into editor"
								>
									Edit ✏️
								</button>
								{/if}
								<button
									on:click={() => deleteItem(item.contentId)}
									class="flex-1 rounded bg-red-600/20 px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-600/30 hover:text-red-300"
									title="Delete"
								>
									Trash 🗑️
								</button>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>