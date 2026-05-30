<!-- src/lib/components/ThreeJsEnhancer/LogoUpload.svelte -->
<!-- Logo Upload Component - Simple File Upload with Preview -->

<script lang="ts">
	import { logoState } from '$lib/stores/logo.store';

	let fileInput: HTMLInputElement;

	function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];

		if (file) {
			// Validate file type
			if (!file.type.startsWith('image/')) {
				alert('Please upload an image file (PNG, JPG, etc.)');
				return;
			}

			// Validate file size (max 5MB)
			if (file.size > 5 * 1024 * 1024) {
				alert('Logo file is too large. Please use an image under 5MB.');
				return;
			}

			logoState.uploadLogo(file);
		}
	}

	function handleRemoveLogo() {
		logoState.clearLogo();
		if (fileInput) {
			fileInput.value = '';
		}
	}
</script>

<div class="flex flex-col gap-2">
	<!-- Upload Button -->
	{#if !$logoState.logoDataUrl}
		<label
			class="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/20 bg-gray-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-600"
		>
			<span>📁 Upload Logo</span>
			<input
				bind:this={fileInput}
				type="file"
				accept="image/*"
				on:change={handleFileSelect}
				class="hidden"
			/>
		</label>
		<p class="text-xs text-gray-400">PNG, JPG, or GIF • Max 5MB</p>
	{:else}
		<!-- Logo Preview & Controls -->
		<div class="flex flex-col gap-2">
			<!-- Preview -->
			<div class="relative rounded-lg border border-white/20 bg-gray-900 p-2">
				<img
					src={$logoState.logoDataUrl}
					alt="Logo preview"
					class="mx-auto max-h-24 w-auto object-contain"
				/>
				<button
					on:click={handleRemoveLogo}
					class="absolute top-1 right-1 rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
					title="Remove logo"
				>
					✕
				</button>
			</div>

			<!-- File Name -->
			<p class="text-xs text-gray-400">
				{$logoState.logoFileName}
			</p>

			<!-- Change Logo Button -->
			<label
				class="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/20 bg-gray-700 px-4 py-2 text-xs text-white transition-colors hover:bg-gray-600"
			>
				<span>🔄 Change Logo</span>
				<input
					bind:this={fileInput}
					type="file"
					accept="image/*"
					on:change={handleFileSelect}
					class="hidden"
				/>
			</label>
		</div>
	{/if}
</div>
