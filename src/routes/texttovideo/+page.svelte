<script lang="ts">
	// $: {
	// 	console.log('🎬 VIDEO STATE CHECK:');
	// 	console.log('  video value:', video);
	// 	console.log('  video type:', typeof video);
	// 	console.log('  video length:', video?.length);
	// 	console.log('  video truthy?', !!video);
	// 	console.log('  isVideoUploaded:', isVideoUploaded);
	// }
	import ThreeJsEnhancer from '$lib/components/ThreeJsEnhancer/ThreeJsEnhancer.svelte';
	import VideoEffectsPanel from '$lib/components/VideoEffectsPanel.svelte';
	import { authStore } from '$lib/stores/auth.store';
	import { saveContentToCloud } from '$lib/utils/saveContent';
	import { onMount } from 'svelte';
	import PromptCoachRefine from '$lib/components/PromptCoachRefine.svelte';

	let prompt = '';
	let duration = 8;
	let operation = '';
	let video = '';
	let status = '';
	let isGenerating = false;
	let aspectRatios = '16:9';
	let uploadedImages: File[] = [];
	let imagePreviews: string[] = [];
	let isProcessingImages = false;
	let uploadedVideoForEditing: string = '';
	let isVideoUploaded = false;
	let showPromptCoach = false;
	// Save state
	let isSaving = false;
	let saveStatus = '';
	let savedContentId = '';
	
	// Enhancement modals
	let showVideoEnhancer = false;
	let showEffectsPanel = false;
	let audioSessionId: string | null = null;
	let isExtractingAudio = false;

	onMount(() => {
		try {
			const saved = sessionStorage.getItem('texttovideo_state');
			if (saved) {
				const state = JSON.parse(saved);
				if (state.video) {
					video = state.video;
					prompt = state.prompt || '';
					status = 'Restored from previous session';
				}
			}
		} catch (err) {
			console.error('Failed to restore session:', err);
		}
	});

	function saveToSession() {
		try {
			if (video.startsWith('data:video')) {
				console.log('⚠️ Skipping sessionStorage for uploaded video (too large)');
				return;
			}

			sessionStorage.setItem(
				'texttovideo_state',
				JSON.stringify({
					video,
					prompt,
					status: 'Done! Ready to enhance or download.'
				})
			);
		} catch (err) {
			console.error('Failed to save session:', err);
		}
	}

	function clearSession() {
		sessionStorage.removeItem('texttovideo_state');
		video = '';
		prompt = '';
		status = '';
		uploadedImages = [];
		imagePreviews = [];
		uploadedVideoForEditing = '';
		isVideoUploaded = false;
		savedContentId = '';
		saveStatus = '';
	}

	async function generate() {
		if (!prompt.trim()) {
			status = 'Error: Prompt is required';
			return;
		}

		isGenerating = true;
		status = 'Generating...';
		video = '';
		savedContentId = '';
		saveStatus = '';

		try {
			if (uploadedImages.length > 0) {
				await generateFromImage();
			} else {
				await generateFromPrompt();
			}
		} catch (err) {
			console.error('Generation error:', err);
			status = `Error: ${err instanceof Error ? err.message : String(err)}`;
			isGenerating = false;
		}
	}

	async function generateFromPrompt() {
		try {
			const res = await fetch('/api/veo2-simple/generateFromImage', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt, duration, aspectRatios })
			});
			const data = await res.json();

			if (data.error) {
				status = `Error: ${data.error}`;
				isGenerating = false;
				return;
			}

			operation = data.operation;

			status = 'Waiting 30 seconds...';
			setTimeout(poll, 30000);
		} catch (err) {
			console.error('Prompt generation error:', err);
			status = `Error: ${err instanceof Error ? err.message : 'Unknown error'}`;
			isGenerating = false;
		}
	}

	async function generateFromImage() {
		const formData = new FormData();

		for (const file of uploadedImages) {
			formData.append('images', file);
		}
		formData.append('prompt', prompt);
		formData.append('duration', duration.toString());
		formData.append('aspectRatios', aspectRatios);

		try {
			const res = await fetch('/api/veo2-simple/generateFromImage', {
				method: 'POST',
				body: formData
			});
			const data = await res.json();

			if (data.error) {
				status = `Error: ${data.error}`;
				isGenerating = false;
				return;
			}

			operation = data.operation;

			status = 'Waiting 30 seconds...';
			setTimeout(poll, 30000);
		} catch (err) {
			console.error('Image generation error:', err);
			status = `Error: ${err instanceof Error ? err.message : 'Unknown error'}`;
			isGenerating = false;
		}
	}

	async function poll() {
		try {
			const res = await fetch('/api/veo2-simple/poll', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ operation })
			});
			const data = await res.json();

			if (data.done) {
				if (data.error) {
					console.error('❌ Generation failed:', data.error);
					status = `Error: ${data.error}`;
					isGenerating = false;
				} else if (data.video) {
					video = data.video;
					saveToSession();
					status = 'Done! Ready to enhance or download.';
					isGenerating = false;
				} else {
					console.error('❌ No video in response');
					status = 'Error: No video generated';
					isGenerating = false;
				}
			} else if (data.error) {
				console.error('❌ Polling error:', data.error);
				status = `Error: ${data.error}`;
				isGenerating = false;
			} else {
				status = 'Still processing...';
				setTimeout(poll, 15000);
			}
		} catch (err) {
			console.error('Polling error:', err);
			status = `Error: ${err instanceof Error ? err.message : 'Polling failed'}`;
			isGenerating = false;
		}
	}
	function handlePromptSelected(selectedPrompt: string) {
		prompt = selectedPrompt;
		showPromptCoach = false;
		status = '✨ Prompt loaded from coach! Ready to refine.';
	}
	async function saveToLibrary() {
		if (!$authStore.user) {
			saveStatus = 'Please sign in to save content';
			return;
		}

		if (!video || video.startsWith('data:video')) {
			saveStatus = 'Cannot save uploaded videos - only generated videos';
			return;
		}

		isSaving = true;
		saveStatus = 'Saving to library...';

		try {
			const result = await saveContentToCloud({
				fileUrl: video,
				type: 'video',
				title: `Video ${new Date().toLocaleDateString()}`,
				description: '',
				prompt: prompt,
				width: aspectRatios === '16:9' ? 1920 : aspectRatios === '9:16' ? 1080 : 1440,
				height: aspectRatios === '16:9' ? 1080 : aspectRatios === '9:16' ? 1920 : 1080,
				format: 'mp4',
				duration: duration,
				model: 'veo-2',
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

	function handleImageUpload(event: Event) {
		const target = event.target as HTMLInputElement;
		const files = target.files;

		if (files && files.length > 0) {
			uploadedImages = Array.from(files);
			imagePreviews = [];
			isProcessingImages = true;

			let loadedCount = 0;

			for (const file of uploadedImages) {
				const reader = new FileReader();
				reader.onload = (e: ProgressEvent<FileReader>) => {
					if (e.target?.result) {
						imagePreviews = [...imagePreviews, e.target.result as string];
					}
					loadedCount++;

					if (loadedCount === uploadedImages.length) {
						isProcessingImages = false;
					}
				};
				reader.readAsDataURL(file);
			}
		}
	}

	function clearImages() {
		uploadedImages = [];
		imagePreviews = [];
	}

	function removeImage(index: number) {
		uploadedImages = uploadedImages.filter((_, i) => i !== index);
		imagePreviews = imagePreviews.filter((_, i) => i !== index);
	}

	function handleVideoUpload(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];

		if (file && file.type.startsWith('video/')) {
			const reader = new FileReader();
			reader.onload = (e: ProgressEvent<FileReader>) => {
				if (e.target?.result) {
					uploadedVideoForEditing = e.target.result as string;
					video = uploadedVideoForEditing;
					saveToSession();
					isVideoUploaded = true;
					status = 'Video uploaded! Ready to edit.';
				}
			};
			reader.readAsDataURL(file);
		} else {
			status = 'Error: Please upload a valid video file';
		}
	}

	function clearUploadedVideo() {
		uploadedVideoForEditing = '';
		video = '';
		isVideoUploaded = false;
		status = '';
		savedContentId = '';
		saveStatus = '';
	}

	async function openVideoEnhancer() {
	if (!video) return;

	isExtractingAudio = true;
	status = 'Preparing enhancer...';

	try {
		const formData = new FormData();

		if (video.startsWith('data:video')) {
			// Local upload — convert base64 data URL to a Blob and send as a file
			const response = await fetch(video);
			const blob = await response.blob();
			formData.append('videoFile', blob, 'input-video.mp4');
		} else {
			// GCS URL — send as a plain URL string, FFmpeg fetches it directly
			formData.append('videoUrl', video);
		}

		const res = await fetch('/api/extractAudio', {
			method: 'POST',
			body: formData
		});

		if (!res.ok) {
			// Extraction endpoint failed — log it but don't block the enhancer
			// User still gets the enhancer, just without audio preservation
			console.warn('⚠️ Audio extraction failed — continuing without audio preservation');
			audioSessionId = null;
		} else {
			const data = await res.json();
			// data.audioSessionId will be null if video had no audio — that's fine
			audioSessionId = data.audioSessionId ?? null;
			if (audioSessionId) {
				console.log(`🎵 Audio preserved — session: ${audioSessionId}`);
			} else {
				console.log('ℹ️ No audio track found — proceeding with visual only');
			}
		}
	} catch (err) {
		// Network error or unexpected failure — don't block the enhancer
		console.warn('⚠️ Audio extraction error — continuing without audio preservation:', err);
		audioSessionId = null;
	} finally {
		isExtractingAudio = false;
		status = video ? 'Done! Ready to enhance or download.' : '';
	}

	// Open the enhancer regardless of whether audio extraction succeeded
	showVideoEnhancer = true;
	}

	function openEffectsPanel() {
		if (video) {
			showEffectsPanel = true;
		}
	}

	function downloadVideo() {
		if (!video) return;
		const a = document.createElement('a');
		a.href = video;
		a.download = `video-${Date.now()}.mp4`;
		document.body.appendChild(a);
		a.click();
		a.remove();
	}
</script>

<div class="flex flex-col gap-6 py-4 lg:flex-row xl:pl-12 2xl:pl-20">
	<!-- LEFT SIDE: Input Controls -->
	<div
		class="flex flex-1 flex-col gap-4 sm:w-full md:w-full lg:max-w-4/5 xl:max-w-3/5 2xl:max-w-1/3"
	>
		<p class="text-center text-sm text-white">Videos come in 4, 6, and 8 seconds.</p>
		<button on:click={() => (showPromptCoach = true)} class="btn max-w-66 gap-2 btn-sm btn-neutral">
			<span>🎨</span>
			<span>Use Prompt Engineer</span>
		</button>
		<!-- Prompt Coach Modal -->
		{#if showPromptCoach}
			<div class="modal-open modal">
				<div class="modal-box h-[70vh] max-w-3xl p-0">
					<div class="flex h-full flex-col">
						<div class="flex items-center justify-between border-b border-base-300 p-4">
							<h3 class="text-lg font-bold">Prompt Engineer</h3>
							<button
								on:click={() => (showPromptCoach = false)}
								class="btn btn-circle btn-ghost btn-sm"
							>
								✕
							</button>
						</div>
						<div class="flex-1 overflow-hidden">
							<PromptCoachRefine onPromptSelected={handlePromptSelected} />
						</div>
					</div>
				</div>
			</div>
		{/if}
		<fieldset class="fieldset">
			<legend class="fieldset-legend">Duration (Video Length)</legend>
			<select bind:value={duration} class="select-bordered select w-full text-white">
				<option disabled selected>Pick a Duration</option>
				<option value={4}>4 seconds</option>
				<option value={6}>6 seconds</option>
				<option value={8}>8 seconds</option>
			</select>
		</fieldset>

		<fieldset class="fieldset">
			<legend class="fieldset-legend">Aspect Ratios</legend>
			<p class="mb-2 text-xs text-white opacity-75">16:9 for Monitors • 9:16 for Phones</p>
			<select bind:value={aspectRatios} class="select-bordered select w-full text-white">
				<option disabled selected>Pick an aspect ratio</option>
				<option value={'16:9'}>16:9</option>
				<option value={'9:16'}>9:16</option>
				<option value={'4:3'}>4:3</option>
			</select>
		</fieldset>

		<fieldset class="fieldset">
			<legend class="fieldset-legend">Upload Image (Optional)</legend>
			<input
				type="file"
				accept="image/*"
				multiple
				on:change={handleImageUpload}
				class="file-input w-full file-input-info"
			/>
			{#if uploadedImages.length > 0}
				<p class="mt-2 text-sm text-success">
					{uploadedImages.length} image(s) selected
				</p>
			{/if}
		</fieldset>

		<fieldset class="fieldset">
			<legend class="fieldset-legend">Prompt</legend>
			<textarea
				bind:value={prompt}
				placeholder={uploadedImages.length > 0
					? 'Describe how to animate the image (e.g., "animate it so it\'s throwing up a thumbs sign")...'
					: 'Describe the video you want to generate...'}
				class="textarea-bordered textarea min-h-[120px] w-full bg-base-100 text-white"
			></textarea>
		</fieldset>

		<div class="flex flex-col gap-3">
			<button
				on:click={generate}
				disabled={isGenerating || !prompt || isVideoUploaded}
				class="btn btn-info {isGenerating || !prompt || isVideoUploaded ? 'btn-disabled' : ''}"
				title={isVideoUploaded ? 'Cannot generate while video is uploaded for editing' : ''}
			>
				{isGenerating ? 'Generating...' : 'Generate Video'}
			</button>

			{#if video && !isGenerating && !isVideoUploaded && !savedContentId}
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

			{#if uploadedImages.length > 0}
				<button on:click={clearImages} class="btn btn-outline btn-sm btn-error">
					Clear Images
				</button>
			{/if}

			<p class="text-center text-sm {status.includes('Error') ? 'text-error' : 'text-info'}">
				{status}
			</p>
		</div>
	</div>

	<!-- RIGHT SIDE: Video Preview and Image Thumbnails -->
	<div
		class="flex flex-1 flex-col gap-4 pt-10 sm:w-full md:w-full lg:w-full lg:pt-15 xl:max-w-2/5 xl:pl-10 2xl:pl-10"
	>
		<!-- Video Display -->
		<div class="relative h-96 w-full rounded-lg bg-base-300">
			{#if isGenerating}
				<div
					class="animate-blur absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-lg"
				>
					<div class="flex flex-col items-center gap-4">
						<div class="loading loading-lg loading-spinner text-info"></div>
						<p class="text-center text-white">Video generating...</p>
					</div>
				</div>
			{:else if video}
				<video src={video} controls class="h-full w-full rounded-lg object-cover">
					<track kind="captions" src="" label="English" srclang="en" />
				</video>
				<!-- Dropdown for Video Enhancements -->
				<div class=" dropdown-hover dropdown absolute top-4 left-4 rounded-lg border-2 border-info">
					<div tabindex="0" role="button" class="btn-default btn m-1 btn-lg">Tools</div>
					<ul
						tabindex="-1"
						class="dropdown-content menu z-1 w-52 rounded-box bg-base-100 p-2 shadow-sm"
					>
						<li>
							<button on:click={openVideoEnhancer} class="btn-default btn mb-2 btn-sm">
								🎬 Enhance
							</button>
						</li>
						<li>
							<button on:click={openEffectsPanel} class="btn-default btn btn-sm">
								✨ Effects
							</button>
						</li>
						{#if isVideoUploaded}
							<li>
								<button on:click={clearUploadedVideo} class="btn-default btn btn-sm">
									🗑️ Remove
								</button>
							</li>
						{/if}
					</ul>
				</div>
			{:else}
				<div class="absolute inset-0 flex items-center justify-center">
					<div class="flex flex-col items-center gap-4">
						<p class="text-center text-white opacity-50">Video will appear here</p>

						<!-- Upload Video Button -->
						<div class="tooltip" data-tip="Upload video for editing (no generation)">
							<label class="btn cursor-pointer btn-outline btn-sm btn-info">
								📤 Upload Video to Edit
								<input type="file" accept="video/*" on:change={handleVideoUpload} class="hidden" />
							</label>
						</div>
					</div>
				</div>
			{/if}
			{#if video}
				<button on:click={clearSession} class="btn-default btn btn-outline btn-sm">
					🔄 Start Fresh
				</button>
			{/if}
		</div>

		<!-- Image Previews -->
		{#if imagePreviews.length > 0}
			<div class="rounded-lg bg-base-300 p-4">
				<p class="mb-3 text-sm font-semibold text-white">Selected Images:</p>
				<div class="flex flex-wrap gap-3">
					{#each imagePreviews as preview, index}
						<div class="group relative h-24 w-24 overflow-hidden rounded-lg border-2 border-info">
							<img src={preview} alt="preview" class="h-full w-full object-cover" />
							<button
								on:click={() => removeImage(index)}
								class="btn absolute top-1 right-1 btn-circle opacity-0 transition-opacity btn-xs btn-error group-hover:opacity-100"
								aria-label="Remove image"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-3 w-3"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M6 18L18 6M6 6l12 12"
									/>
								</svg>
							</button>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>

{#if showVideoEnhancer && video}
	<ThreeJsEnhancer
 		videoUrl={video} 		
 		{audioSessionId}
 		onClose={() => {
		showVideoEnhancer = false;
 		audioSessionId = null;
		}}
 	/>
 {/if}

<!-- NEW: Video Effects Panel Modal -->
{#if showEffectsPanel && video}
	<VideoEffectsPanel
		videoUrl={video}
		onClose={() => {
			showEffectsPanel = false;
		}}
	/>
{/if}
