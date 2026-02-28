<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { authStore } from '$lib/stores/auth.store';
	import { workflowContext } from '$lib/stores/workflow.store';
	import { imageGenStore, formatTimestamp } from '$lib/stores/imageGen.store';
	import { saveContentToCloud } from '$lib/utils/saveContent';
	import { canGenerate, recordGeneration } from '$lib/stores/subscription.store';
	import UsageLimitModal from '$lib/components/UsageLimitModal.svelte';
	import type { UsageCheckResult } from '$lib/types/subscription';

	// Subscribe to the imageGen store
	$: state = $imageGenStore;

	// Save state
	let isSaving = false;
	let saveStatus = '';
	let savedContentId = '';

	// Paywall state
	let showUsageLimitModal = false;
	let usageLimitData: UsageCheckResult | null = null;

	// Read prompt from URL parameter on mount
	onMount(() => {
		const urlPrompt = $page.url.searchParams.get('prompt');
		const fromCoach = $page.url.searchParams.get('from');

		if (urlPrompt) {
			imageGenStore.setPrompt(urlPrompt);

			if (fromCoach === 'coach') {
				workflowContext.startCurrentStep();
				imageGenStore.setStatus('✨ Prompt loaded from coach! Ready to generate.');
			}
		}
	});

	async function generateImage() {
		// Check usage before firing the request
		const usageCheck = await canGenerate('image');

		if (!usageCheck.allowed) {
			usageLimitData = usageCheck;
			showUsageLimitModal = true;
			return;
		}

		imageGenStore.startGeneration();
		workflowContext.startCurrentStep();

		try {
			const response = await fetch('/api/imageGen', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt: state.prompt })
			});

			const data = await response.json();

			// Handle usage limit response from server (429)
			if (response.status === 429 || data.error === 'limit_reached') {
				imageGenStore.setError('');
				usageLimitData = data.usage || usageCheck;
				showUsageLimitModal = true;
				imageGenStore.setStatus('');
				return;
			}

			if (data.error) {
				throw new Error(data.error);
			}

			const { imageUrl, imageBase64 } = data;
			const finalUrl = imageUrl || (imageBase64 ? `data:image/png;base64,${imageBase64}` : null);

			if (!finalUrl) {
				throw new Error('No image URL or base64 data received');
			}

			imageGenStore.setGeneratedImage(finalUrl, imageBase64, state.prompt);
			workflowContext.completeCurrentStep(finalUrl);

			// Record successful generation
			await recordGeneration('image');

			savedContentId = '';
			saveStatus = '';
		} catch (err) {
			console.error('Image generation error:', err);
			const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
			imageGenStore.setError(errorMessage);
		}
	}

	async function saveToLibrary() {
		if (!$authStore.user) {
			saveStatus = 'Please sign in to save content';
			return;
		}

		const currentImage = imageGenStore.getCurrentImage(state);
		if (!currentImage) {
			saveStatus = 'No image to save';
			return;
		}

		isSaving = true;
		saveStatus = 'Saving to library...';

		try {
			const result = await saveContentToCloud({
				fileUrl: currentImage,
				type: 'image',
				title: `Image ${new Date().toLocaleDateString()}`,
				description: '',
				prompt: state.prompt,
				width: 1024,
				height: 1024,
				format: 'png',
				model: 'gpt-image-1.5',
				generationTime: 0,
				tags: []
			});

			if (result.success) {
				savedContentId = result.contentId || '';
				saveStatus = '✅ Saved to library!';
				setTimeout(() => {
					saveStatus = '';
				}, 3000);
			} else {
				saveStatus = `Error: ${result.error}`;
			}
		} catch (error) {
			console.error('Save error:', error);
			saveStatus = 'Failed to save';
		} finally {
			isSaving = false;
		}
	}

	function downloadImage() {
		const currentImage = imageGenStore.getCurrentImage(state);
		if (!currentImage) return;

		const a = document.createElement('a');
		a.href = currentImage;
		a.download = `content-factory-${Date.now()}.png`;
		document.body.appendChild(a);
		a.click();
		a.remove();
	}

	function clearSession() {
		imageGenStore.clearCurrent();
		imageGenStore.setStatus('');
		savedContentId = '';
		saveStatus = '';
	}

	function loadFromHistory(index: number) {
		imageGenStore.loadFromHistory(index);
		savedContentId = '';
		saveStatus = '';
	}

	$: currentImage = imageGenStore.getCurrentImage(state);
	$: hasImage = imageGenStore.hasImage(state);
</script>

<!-- Usage Limit Modal -->
<UsageLimitModal
	bind:show={showUsageLimitModal}
	usageData={usageLimitData}
	generationType="image"
/>

<div class="flex flex-col gap-6 py-4 lg:flex-row xl:pl-12 2xl:pl-20">
	<!-- LEFT SIDE: Input Controls -->
	<div
		class="flex flex-1 flex-col gap-4 sm:w-full md:w-full lg:max-w-4/5 xl:max-w-3/5 2xl:max-w-1/3"
	>
		<div class="text-center">
			<h2 class="mb-2 text-xl font-bold text-white">Create</h2>
			<p class="text-sm text-white/70">
				Generate unique, artistic images Using **Original** Creations
			</p>
		</div>

		<fieldset class="fieldset">
			<legend class="fieldset-legend">Prompt</legend>
			<textarea
				bind:value={state.prompt}
				on:input={(e) => imageGenStore.setPrompt(e.currentTarget.value)}
				placeholder="Describe the image you want to generate..."
				class="textarea-bordered textarea w-full resize-y bg-base-100 text-white"
				style="min-height: 120px; max-height: 500px;"
				rows="5"
			></textarea>
			<p class="mt-1 text-xs text-base-content/50">
				💡 More detail = better results. Describe style, mood, colors, composition.
			</p>
		</fieldset>

		<div class="flex flex-col gap-3">
			<button
				on:click={generateImage}
				disabled={state.loading || !state.prompt}
				class="btn btn-neutral {state.loading || !state.prompt ? 'btn-disabled' : ''}"
			>
				{state.loading ? 'Generating...' : 'Generate Image'}
			</button>

			{#if hasImage && !state.loading && !savedContentId}
				<button
					on:click={saveToLibrary}
					disabled={isSaving || !$authStore.user}
					class="btn btn-primary {isSaving || !$authStore.user ? 'btn-disabled' : ''}"
				>
					{isSaving ? 'Saving...' : '💾 Save to Library'}
				</button>
			{/if}

			{#if savedContentId}
				<div class="alert py-2 alert-success">
					<span class="text-sm"
						>✅ Saved! <a href="/content-library" class="link">View in Content Library</a></span
					>
				</div>
			{/if}

			{#if saveStatus && !savedContentId}
				<div class="alert {saveStatus.includes('Error') ? 'alert-error' : 'alert-info'} py-2">
					<span class="text-sm">{saveStatus}</span>
				</div>
			{/if}

			{#if hasImage || state.prompt}
				<button on:click={clearSession} class="btn btn-ghost btn-sm"> 🗑️ Start Fresh </button>
			{/if}

			{#if state.status}
				<div
					class="alert {state.error
						? 'alert-error'
						: state.status.includes('✅')
							? 'alert-success'
							: 'alert-info'} py-2"
				>
					<span class="text-sm">{state.status}</span>
				</div>
			{/if}

			{#if state.error}
				<div class="alert py-2 alert-error">
					<span class="text-sm">❌ {state.error}</span>
				</div>
			{/if}
		</div>

		<!-- Workflow Navigation Hint -->
		{#if hasImage && !state.loading}
			<div class="card border border-neutral bg-neutral/20">
				<div class="card-body p-4">
					<h3 class="flex items-center gap-2 text-sm font-bold">
						<span>🎯</span>
						<span>Next Step: Refine</span>
					</h3>
					<p class="mt-2 text-xs text-base-content/70">
						Download your image, then upload it to <strong>Refine</strong> (Image Edit) in the sidebar
						to add photorealistic perfection while keeping that unique style.
					</p>
					<a href="/imageedit" class="btn mt-3 btn-sm btn-neutral"> Go to Refine → </a>
				</div>
			</div>
		{/if}

		<!-- History Section -->
		{#if state.history.length > 0}
			<div class="card border border-base-300 bg-base-200">
				<div class="card-body p-4">
					<h3 class="text-sm font-bold">📜 Recent Generations ({state.history.length})</h3>
					<div class="mt-2 flex flex-col gap-2">
						{#each state.history as item, i}
							<button
								on:click={() => loadFromHistory(i)}
								class="btn justify-start text-left btn-ghost btn-sm"
							>
								<span class="truncate text-xs">
									{item.prompt.substring(0, 40)}{item.prompt.length > 40 ? '...' : ''}
								</span>
								<span class="ml-auto text-xs opacity-50">
									{formatTimestamp(item.generatedAt)}
								</span>
							</button>
						{/each}
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- RIGHT SIDE: Image Preview -->
	<div
		class="flex flex-1 flex-col gap-4 pt-10 sm:w-full md:w-full lg:w-full lg:pt-15 xl:max-w-2/5 xl:pl-10 2xl:pl-10"
	>
		<div class="relative h-96 w-full overflow-hidden rounded-lg bg-base-300">
			{#if state.loading}
				<div
					class="animate-blur absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-lg"
				>
					<div class="flex flex-col items-center gap-4">
						<div class="loading loading-lg loading-spinner text-neutral"></div>
						<p class="text-center text-white">Creating your unique image...</p>
					</div>
				</div>
			{:else if currentImage}
				<img src={currentImage} alt="Generated" class="h-full w-full rounded-lg object-contain" />
				<button on:click={downloadImage} class="btn absolute top-4 right-4 btn-sm btn-neutral">
					Download
				</button>
				{#if state.generatedAt}
					<div class="absolute bottom-4 left-4 rounded bg-black/50 px-2 py-1 text-xs text-white">
						Generated {formatTimestamp(state.generatedAt)}
					</div>
				{/if}
			{:else}
				<div class="absolute inset-0 flex items-center justify-center">
					<p class="text-center text-white opacity-50">Image will appear here</p>
				</div>
			{/if}
		</div>
	</div>
</div>