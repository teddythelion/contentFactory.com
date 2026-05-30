<!-- ImageUploader.svelte - Upload any image for 3D editing -->
<script lang="ts">
	import ThreeJsEnhancer from '$lib/components/ThreeJSEnhancer.svelte';

	let fileInput: HTMLInputElement;
	let uploadedImageUrl: string | null = null;
	let showEnhancer = false;

	function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];

		if (!file) return;

		// Validate file type
		if (!file.type.startsWith('image/')) {
			alert('Please upload an image file (PNG, JPG, GIF, etc.)');
			return;
		}

		// Create object URL for the image
		const reader = new FileReader();
		reader.onload = (e) => {
			uploadedImageUrl = e.target?.result as string;
			showEnhancer = true;
		};
		reader.readAsDataURL(file);
	}

	function openFileDialog() {
		fileInput.click();
	}

	function closeEnhancer() {
		showEnhancer = false;
		// Keep the image loaded so they can re-edit
	}

	function clearImage() {
		uploadedImageUrl = null;
		showEnhancer = false;
		if (fileInput) {
			fileInput.value = '';
		}
	}
</script>

<!-- Hidden file input -->
<input
	type="file"
	bind:this={fileInput}
	on:change={handleFileSelect}
	accept="image/*"
	class="hidden"
/>

<!-- Upload Button for Main Display -->
{#if !uploadedImageUrl}
	<!-- Upload Card -->
	<div class="card bg-base-200 shadow-xl">
		<div class="card-body items-center text-center">
			<h2 class="card-title text-2xl">3D Image Editor</h2>
			<p class="text-base-content/70">Upload any image to transform it with 3D effects</p>
			<div class="card-actions">
				<button on:click={openFileDialog} class="btn gap-2 btn-lg btn-info">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
						/>
					</svg>
					Upload Image
				</button>
			</div>
			<p class="mt-4 text-xs text-base-content/50">Supports: PNG, JPG, GIF, WebP</p>
		</div>
	</div>
{:else}
	<!-- Image Preview Card -->
	<div class="card bg-base-200 shadow-xl">
		<figure class="relative">
			<img src={uploadedImageUrl} alt="Uploaded" class="max-h-96 object-contain" />
		</figure>
		<div class="card-body">
			<h2 class="card-title">Image Ready to Edit</h2>
			<p class="text-sm text-base-content/70">Apply 3D effects to your image</p>
			<div class="card-actions justify-end">
				<button on:click={clearImage} class="btn gap-2 btn-outline btn-sm btn-error">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
						/>
					</svg>
					Remove
				</button>
				<button on:click={openFileDialog} class="btn gap-2 btn-outline btn-sm">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
						/>
					</svg>
					Change Image
				</button>
				<button on:click={() => (showEnhancer = true)} class="btn gap-2 btn-sm btn-info">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
						/>
					</svg>
					Edit in 3D
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- 3D Enhancer Modal -->
{#if showEnhancer && uploadedImageUrl}
	<ThreeJsEnhancer imageUrl={uploadedImageUrl} onClose={closeEnhancer} />
{/if}
