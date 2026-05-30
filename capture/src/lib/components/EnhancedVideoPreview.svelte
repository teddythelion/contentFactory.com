<script lang="ts">
	export let videoUrl: string;
	export let contentId: string;
	export let onPost: (url: string) => void;
	export let onClose: () => void;

	let isDownloading = false;

	async function downloadVideo() {
		isDownloading = true;
		try {
			const response = await fetch(videoUrl);
			const blob = await response.blob();

			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `enhanced-video-${contentId}.mp4`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);

			setTimeout(() => URL.revokeObjectURL(url), 1000);
		} catch (error) {
			console.error('Download failed:', error);
		} finally {
			isDownloading = false;
		}
	}
</script>

<div class="modal-open modal">
	<div class="modal-box w-full max-w-2xl">
		<h3 class="mb-4 text-2xl font-bold">Enhanced Video Ready</h3>

		<!-- Video Preview -->
		<div class="mb-4 rounded-lg bg-base-300 p-4">
			<video src={videoUrl} controls class="w-full rounded-lg"></video>
		</div>

		<!-- Buttons -->
		<div class="flex gap-3">
			<!-- Download Button -->
			<button on:click={downloadVideo} disabled={isDownloading} class="btn flex-1 btn-outline">
				{#if isDownloading}
					<span class="loading loading-spinner"></span>
					Downloading...
				{:else}
					⬇️ Download Locally
				{/if}
			</button>

			<!-- Post to Social Button -->
			<button on:click={() => onPost(videoUrl)} class="btn flex-1 btn-primary">
				📱 Post to Social
			</button>

			<!-- Close Button -->
			<button on:click={onClose} class="btn btn-ghost"> Close </button>
		</div>
	</div>
</div>
