<!-- src/routes/create/+page.svelte -->
<script lang="ts">
	import { authStore } from '$lib/stores/auth.store';
	import { canGenerate } from '$lib/stores/subscription.store';
	import PromptCoachRefine from '$lib/components/PromptCoachRefine.svelte';
	import UsageLimitModal from '$lib/components/UsageLimitModal.svelte';
	import AuthModal from '$lib/components/AuthModal.svelte';
	import ThreeJsEnhancer from '$lib/components/ThreeJsEnhancer/ThreeJsEnhancer.svelte';
	import ThreeJSEnhancer from '$lib/components/ThreeJSEnhancer.svelte';
	import type { UsageCheckResult } from '$lib/types/subscription';

	// ── Core state ────────────────────────────────────────────────────────────
	let mode = $state<'image' | 'video'>('image');
	let prompt = $state('');
	let generatedContent = $state<string | null>(null);
	let contentType = $state<'image' | 'video' | null>(null);
	let isGenerating = $state(false);
	let status = $state('');
	let error = $state('');

	// Edit source — loaded into canvas for direct editing, not a generation reference
	let editSourceUrl = $state<string | null>(null);
	let editSourceFileName = $state('');

	// Reference images — 0–3 slots, influence generation
	let referenceFiles = $state<File[]>([]);
	let referencePreviews = $state<string[]>([]);

	// Video-only
	let duration = $state<4 | 6 | 8>(8);
	let aspectRatio = $state<'16:9' | '9:16' | '4:3'>('16:9');
	let videoOperation = $state<string | null>(null);
	let audioSessionId = $state<string | null>(null);
	let showAdvanced = $state(false);

	// UI toggles
	let showPromptCoach = $state(false);
	let showAuthModal = $state(false);
	let showAuthToast = $state(false);
	let showUsageLimitModal = $state(false);
	let usageLimitData = $state<UsageCheckResult | null>(null);
	let showVideoEnhancer = $state(false);
	let showImageEnhancer = $state(false);
	let toastMessage = $state('');
	let showToast = $state(false);

	// Derived
	let hasContent = $derived(!!generatedContent || !!editSourceUrl);
	let canAddRef = $derived(referenceFiles.length < 3);
	let activeUrl = $derived(generatedContent ?? editSourceUrl);
	let activeContentType = $derived(contentType ?? (editSourceUrl ? mode : null));

	// ── Mode switch ───────────────────────────────────────────────────────────
	function switchMode(newMode: 'image' | 'video') {
		if (newMode === mode || isGenerating) return;
		mode = newMode;
		// Clear edit source — an image file can't render as a video element and vice versa
		if (editSourceUrl?.startsWith('blob:')) URL.revokeObjectURL(editSourceUrl);
		editSourceUrl = null;
		editSourceFileName = '';
		error = '';
		status = '';
	}

	// ── Clear all ─────────────────────────────────────────────────────────────
	function clearAll() {
		if (editSourceUrl?.startsWith('blob:')) URL.revokeObjectURL(editSourceUrl);
		referencePreviews.forEach(p => { if (p?.startsWith('blob:')) URL.revokeObjectURL(p); });
		generatedContent = null;
		contentType = null;
		prompt = '';
		referenceFiles = [];
		referencePreviews = [];
		editSourceUrl = null;
		editSourceFileName = '';
		videoOperation = null;
		audioSessionId = null;
		isGenerating = false;
		status = '';
		error = '';
	}

	// ── Auth guard ────────────────────────────────────────────────────────────
	function requireAuth(): boolean {
		if (!$authStore.user) {
			showAuthToast = true;
			setTimeout(() => { showAuthToast = false; }, 5000);
			return false;
		}
		return true;
	}

	// ── HEIC guard — browsers can't render HEIC natively ─────────────────────
	function isHeic(file: File): boolean {
		return (
			file.type === 'image/heic' ||
			file.type === 'image/heif' ||
			/\.heic$/i.test(file.name) ||
			/\.heif$/i.test(file.name)
		);
	}

	// ── Reference images ──────────────────────────────────────────────────────
	function addReferenceImages(event: Event) {
		if (!canAddRef || isGenerating) return;
		const input = event.target as HTMLInputElement;
		const allFiles = Array.from(input.files ?? []);
		input.value = '';
		if (!allFiles.length) return;
		const heicFiles = allFiles.filter(isHeic);
		if (heicFiles.length) {
			showToastMsg('HEIC/HEIF images are not supported. Please convert to JPEG or PNG first.');
			return;
		}
		const newFiles = allFiles.slice(0, 3 - referenceFiles.length);
		if (!newFiles.length) return;
		// createObjectURL is synchronous — thumbnail appears instantly, no async gap
		const newPreviews = newFiles.map(f => URL.createObjectURL(f));
		referencePreviews = [...referencePreviews, ...newPreviews];
		referenceFiles = [...referenceFiles, ...newFiles];
	}

	function removeReference(i: number) {
		const preview = referencePreviews[i];
		if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
		referenceFiles = referenceFiles.filter((_, idx) => idx !== i);
		referencePreviews = referencePreviews.filter((_, idx) => idx !== i);
	}

	// ── Edit source ───────────────────────────────────────────────────────────
	function handleEditSourceUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		input.value = '';
		if (isHeic(file)) {
			showToastMsg('HEIC/HEIF images are not supported. Please convert to JPEG or PNG first.');
			return;
		}
		if (editSourceUrl?.startsWith('blob:')) URL.revokeObjectURL(editSourceUrl);
		editSourceFileName = file.name;
		editSourceUrl = URL.createObjectURL(file);
		generatedContent = null;
		contentType = null;
	}

	function clearEditSource() {
		if (editSourceUrl?.startsWith('blob:')) URL.revokeObjectURL(editSourceUrl);
		editSourceUrl = null;
		editSourceFileName = '';
	}

	// ── Generate ──────────────────────────────────────────────────────────────
	async function generate() {
		if (!requireAuth() || !prompt.trim() || isGenerating) return;

		const usageCheck = await canGenerate(mode);
		if (!usageCheck.allowed) {
			usageLimitData = usageCheck;
			showUsageLimitModal = true;
			return;
		}

		isGenerating = true;
		error = '';
		generatedContent = null;
		contentType = null;
		status = mode === 'image' ? 'Generating...' : 'Starting...';

		try {
			if (mode === 'image') {
				await generateImage();
				isGenerating = false;
			} else {
				await startVideoGeneration();
				// isGenerating stays true; pollVideo will clear it
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			// Billing / quota errors → show the upgrade modal instead of a raw error string
			if (msg.toLowerCase().includes('billing') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('limit') || msg.toLowerCase().includes('limit_reached')) {
				showUsageLimitModal = true;
			} else {
				error = msg;
			}
			status = '';
			isGenerating = false;
		}
	}

	async function generateImage() {
		const fd = new FormData();
		fd.append('prompt', prompt);
		referenceFiles.forEach(f => fd.append('images', f));

		const response = await fetch('/api/imageEdit', { method: 'POST', body: fd });
		const data = await response.json();

		if (response.status === 429 || data.error === 'limit_reached') {
			usageLimitData = data.usage;
			showUsageLimitModal = true;
			status = '';
			return;
		}
		if (!data.success) throw new Error(data.error || 'Image generation failed');

		if (!data.imageUrl) throw new Error('No image received from server');
		generatedContent = data.imageUrl;
		contentType = 'image';
		status = '';
	}

	async function startVideoGeneration() {
		let response: Response;
		if (referenceFiles.length > 0) {
			const fd = new FormData();
			referenceFiles.forEach(f => fd.append('images', f));
			fd.append('prompt', prompt);
			fd.append('duration', duration.toString());
			fd.append('aspectRatios', aspectRatio);
			response = await fetch('/api/veo2-simple/generateFromImage', { method: 'POST', body: fd });
		} else {
			response = await fetch('/api/veo2-simple/generateFromImage', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt, duration, aspectRatios: aspectRatio })
			});
		}
		const data = await response.json();
		if (data.error) throw new Error(data.error);
		videoOperation = data.operation;
		status = 'Processing... usually 30–90 seconds';
		setTimeout(pollVideo, 30000);
	}

	async function pollVideo() {
		try {
			const res = await fetch('/api/veo2-simple/poll', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ operation: videoOperation })
			});
			const data = await res.json();
			if (data.done) {
				isGenerating = false;
				if (data.error) {
					error = data.error;
					status = '';
				} else if (data.video) {
					generatedContent = data.video;
					contentType = 'video';
					status = '';
					// Server (generateFromImage endpoint) already calls incrementUsage — no client call needed
				}
			} else if (data.error) {
				isGenerating = false;
				error = data.error;
			} else {
				status = 'Still generating...';
				setTimeout(pollVideo, 15000);
			}
		} catch (err) {
			isGenerating = false;
			error = err instanceof Error ? err.message : 'Polling failed';
		}
	}

	// ── Prompt coach ──────────────────────────────────────────────────────────
	function handlePromptSelected(p: string) {
		prompt = p;
		showPromptCoach = false;
	}

	// ── Edit content ──────────────────────────────────────────────────────────
	async function editContent() {
		if (!requireAuth() || !activeUrl) return;

		if (activeContentType === 'video') {
			status = 'Preparing editor...';
			try {
				const fd = new FormData();
				if (activeUrl.startsWith('data:video')) {
					const blob = await (await fetch(activeUrl)).blob();
					fd.append('videoFile', blob, 'video.mp4');
				} else {
					fd.append('videoUrl', activeUrl);
				}
				const res = await fetch('/api/extractAudio', { method: 'POST', body: fd });
				audioSessionId = res.ok ? ((await res.json()).audioSessionId ?? null) : null;
			} catch { audioSessionId = null; }
			status = '';
			showVideoEnhancer = true;
		} else {
			showImageEnhancer = true;
		}
	}

	// ── Send to video refs (image mode only) ──────────────────────────────────
	async function sendToVideoRefs() {
		if (!generatedContent) return;
		const url = generatedContent;

		// Clear existing refs from image generation, add generated image as first slot
		referencePreviews = [url];
		try {
			const blob = await (await fetch(url)).blob();
			referenceFiles = [new File([blob], 'generated-ref.png', { type: blob.type || 'image/png' })];
		} catch {
			referenceFiles = [];
		}

		// Clear canvas and switch to video mode
		generatedContent = null;
		contentType = null;
		mode = 'video';

		showToastMsg('Generated image sent as video reference. Re-add any other references manually if needed.');
	}

	// ── Send locally uploaded edit source to video refs ──────────────────────
	async function sendEditSourceToVideoRefs() {
		if (!editSourceUrl) return;
		const url = editSourceUrl;
		referencePreviews = [url];
		try {
			const blob = await (await fetch(url)).blob();
			referenceFiles = [new File([blob], 'uploaded-ref.png', { type: blob.type || 'image/png' })];
		} catch { referenceFiles = []; }
		editSourceUrl = null;
		editSourceFileName = '';
		generatedContent = null;
		contentType = null;
		mode = 'video';
		showToastMsg('Uploaded image sent as video reference.');
	}

	function showToastMsg(msg: string) {
		toastMessage = msg;
		showToast = true;
		setTimeout(() => { showToast = false; }, 5000);
	}

	// ── Download ──────────────────────────────────────────────────────────────
	async function downloadContent() {
		if (!activeUrl) return;
		const isVideo = activeContentType === 'video';
		const ext = isVideo ? 'mp4' : 'png';
		const fileName = `content-factory-${Date.now()}.${ext}`;
		const a = document.createElement('a');

		if (activeUrl.startsWith('data:')) {
			// Data URL (images) — blob it locally
			const blob = await (await fetch(activeUrl)).blob();
			a.href = URL.createObjectURL(blob);
			a.download = fileName;
			a.click();
			URL.revokeObjectURL(a.href);
		} else {
			// Remote URL (videos) — proxy through server to avoid CORS
			a.href = `/api/content/download?url=${encodeURIComponent(activeUrl)}&name=${encodeURIComponent(fileName)}`;
			a.download = fileName;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
		}
	}
</script>

<!-- ── Modals & Overlays ────────────────────────────────────────────────────── -->
<AuthModal bind:isOpen={showAuthModal} />

<UsageLimitModal
	bind:show={showUsageLimitModal}
	usageData={usageLimitData}
	generationType={mode}
/>

{#if showPromptCoach}
	<div class="modal modal-open z-50">
		<div class="modal-box h-[70vh] max-w-3xl p-0">
			<div class="flex h-full flex-col">
				<div class="flex items-center justify-between border-b border-base-300 p-4">
					<h3 class="text-lg font-bold">Prompt Engineer</h3>
					<button onclick={() => (showPromptCoach = false)} class="btn btn-circle btn-ghost btn-sm">✕</button>
				</div>
				<div class="flex-1 overflow-hidden">
					<PromptCoachRefine onPromptSelected={handlePromptSelected} />
				</div>
			</div>
		</div>
		<div class="modal-backdrop" onclick={() => (showPromptCoach = false)} onkeydown={() => {}}></div>
	</div>
{/if}

{#if showVideoEnhancer && activeUrl}
	<ThreeJsEnhancer
		videoUrl={activeUrl}
		{audioSessionId}
		onClose={() => { showVideoEnhancer = false; audioSessionId = null; }}
	/>
{/if}

{#if showImageEnhancer && activeUrl}
	<ThreeJSEnhancer
		imageUrl={activeUrl}
		onClose={() => { showImageEnhancer = false; }}
		onSendToVideoRefs={async (dataUrl: string) => {
			showImageEnhancer = false;
			referencePreviews = [dataUrl];
			try {
				const blob = await (await fetch(dataUrl)).blob();
				referenceFiles = [new File([blob], 'enhanced-ref.png', { type: 'image/png' })];
			} catch { referenceFiles = []; }
			generatedContent = null;
			contentType = null;
			editSourceUrl = null;
			editSourceFileName = '';
			mode = 'video';
			showToastMsg('Enhanced image sent as video reference.');
		}}
	/>
{/if}

<!-- ── Toast ──────────────────────────────────────────────────────────────────── -->
{#if showToast}
	<div class="toast toast-top toast-center z-[9999]">
		<div class="alert alert-info max-w-sm shadow-lg">
			<span class="text-sm">{toastMessage}</span>
		</div>
	</div>
{/if}

{#if showAuthToast}
	<div class="toast toast-top toast-center z-[9999]">
		<div class="alert alert-warning flex flex-col gap-2 max-w-sm shadow-2xl">
			<div class="flex items-center gap-2">
				<span class="text-2xl">🔒</span>
				<div>
					<p class="font-bold">Sign in required</p>
					<p class="text-sm">You need to be signed in to use this tool.</p>
				</div>
				<button onclick={() => (showAuthToast = false)} class="btn btn-ghost btn-xs ml-auto">✕</button>
			</div>
			<button onclick={() => { showAuthModal = true; showAuthToast = false; }} class="btn btn-primary btn-sm w-full">
				Sign In Now
			</button>
		</div>
	</div>
{/if}

<!-- ── Main layout ────────────────────────────────────────────────────────────── -->
<div class="flex justify-center py-4 px-4 xl:pl-12 2xl:pl-20">
	<div class="w-full max-w-2xl">

		<!-- Card -->
		<div class="rounded-2xl bg-base-200 border border-base-300 overflow-hidden shadow-lg">

			<!-- ── Header ────────────────────────────────────────────────────────── -->
			<div class="flex items-center gap-3 px-5 py-4 border-b border-base-300">
				<!-- Logo text -->
				<div class="flex items-center gap-2 text-base-content/80 shrink-0">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4 text-primary">
						<path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
					</svg>
					<span class="font-semibold text-sm">Creation factory</span>
				</div>

				<!-- Mode toggle -->
				<div class="join ml-1">
					<button
						class="join-item btn btn-sm gap-1.5 {mode === 'image' ? 'btn-neutral' : 'btn-ghost opacity-60'}"
						onclick={() => switchMode('image')}
						disabled={isGenerating}
					>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-3.5">
							<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
						</svg>
						Image
					</button>
					<button
						class="join-item btn btn-sm gap-1.5 {mode === 'video' ? 'btn-neutral' : 'btn-ghost opacity-60'}"
						onclick={() => switchMode('video')}
						disabled={isGenerating}
					>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-3.5">
							<path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
						</svg>
						Video
					</button>
				</div>

				<!-- Clear all -->
				<button
					class="btn btn-sm btn-ghost text-error ml-auto gap-1.5"
					onclick={clearAll}
					disabled={isGenerating}
				>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-3.5">
						<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
					</svg>
					Clear all
				</button>
			</div>

			<!-- ── Canvas ─────────────────────────────────────────────────────────── -->
			<div class="px-5 pt-5">
				<div
					class="relative rounded-xl bg-base-100 overflow-hidden border-2 {hasContent ? 'border-base-300' : 'border-dashed border-base-300/60'}"
					style="min-height: 320px;"
				>
					{#if isGenerating}
						<!-- Generating state -->
						<div class="absolute inset-0 flex flex-col items-center justify-center gap-4">
							<div class="loading loading-spinner loading-lg text-base-content/40"></div>
							<div class="text-center">
								<p class="font-medium text-base-content/80">Generating...</p>
								<p class="text-xs text-base-content/40 mt-1">
									This usually takes {mode === 'image' ? '15–30' : '30–90'} seconds
								</p>
							</div>
						</div>

					{:else if activeContentType === 'image' && activeUrl}
						<!-- Image content -->
						<img
							src={activeUrl}
							alt="Generated"
							class="w-full object-contain rounded-xl"
							style="min-height: 320px; max-height: 560px;"
						/>
						<!-- Overlay actions -->
						<div class="absolute top-3 right-3 flex gap-2">
							<button onclick={downloadContent} class="btn btn-sm btn-neutral gap-1.5 shadow-lg" title="Download">
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-3.5">
									<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
								</svg>
								Download
							</button>
							<button onclick={editContent} class="btn btn-sm btn-neutral gap-1.5 shadow-lg">
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-3.5">
									<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
								</svg>
								Edit content
							</button>
							{#if contentType === 'image' || editSourceUrl}
								<button onclick={editSourceUrl && !generatedContent ? sendEditSourceToVideoRefs : sendToVideoRefs} class="btn btn-sm btn-neutral gap-1.5 shadow-lg">
									<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-3.5">
										<path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
									</svg>
									Send to video refs
								</button>
							{/if}
						</div>

					{:else if activeContentType === 'video' && activeUrl}
						<!-- Video content -->
						<video
							src={activeUrl}
							controls
							class="w-full rounded-xl object-cover"
							style="min-height: 320px;"
						>
							<track kind="captions" src="" label="English" srclang="en" />
						</video>
						<!-- Overlay actions -->
						<div class="absolute top-3 right-3 flex gap-2">
							<button onclick={downloadContent} class="btn btn-sm btn-neutral gap-1.5 shadow-lg" title="Download">
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-3.5">
									<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
								</svg>
								Download
							</button>
							<button onclick={editContent} class="btn btn-sm btn-neutral gap-1.5 shadow-lg">
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-3.5">
									<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
								</svg>
								Edit content
							</button>
						</div>

					{:else}
						<!-- Empty state -->
						<div class="absolute inset-0 flex flex-col items-center justify-center gap-3 text-base-content/25">
							{#if mode === 'image'}
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="size-10">
									<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
								</svg>
								<p class="text-sm">Generated image appears here</p>
							{:else}
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="size-10">
									<path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
								</svg>
								<p class="text-sm">Generated video appears here</p>
							{/if}
						</div>
					{/if}
				</div>
			</div>

			<!-- ── Bottom controls ────────────────────────────────────────────────── -->
			<div class="px-5 pb-5 pt-4 {isGenerating ? 'opacity-50 pointer-events-none select-none' : ''}">

				<!-- Prompt + action buttons -->
				<div class="flex gap-3 rounded-xl bg-base-100 border border-base-300 p-3">
					<textarea
						value={prompt}
						oninput={e => (prompt = e.currentTarget.value)}
						placeholder={mode === 'image'
							? 'Describe the image you want to create...'
							: 'Describe the video you want to create...'}
						class="flex-1 bg-transparent resize-none text-sm outline-none min-h-[48px] max-h-[180px] placeholder:text-base-content/30"
						rows="2"
						disabled={isGenerating}
					></textarea>
					<div class="flex flex-col gap-2 shrink-0">
						<button
							onclick={() => (showPromptCoach = true)}
							class="btn btn-sm btn-neutral gap-1.5 whitespace-nowrap"
							disabled={isGenerating}
						>
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-3.5">
								<path d="M15 4V2m0 2v16m0-16H9m6 0h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
							</svg>
							Prompt engineer
						</button>
						<button
							onclick={generate}
							disabled={isGenerating || !prompt.trim()}
							class="btn btn-sm {isGenerating ? 'btn-neutral' : 'btn-primary'} gap-1.5"
						>
							{#if isGenerating}
								<div class="loading loading-spinner loading-xs"></div>
								Generating
							{:else}
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-3.5">
									<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
								</svg>
								Generate
							{/if}
						</button>
					</div>
				</div>

				{#if isGenerating && status}
					<p class="text-center text-xs text-base-content/40 mt-2">Controls are disabled while generation is in progress</p>
				{/if}

				{#if error}
					<div class="alert alert-error py-2 mt-3 text-sm">
						<span>❌ {error}</span>
					</div>
				{/if}

				<!-- Edit source + Reference images -->
				<div class="mt-4 grid grid-cols-3 gap-4">

					<!-- Edit source (1 col) -->
					<div>
						<p class="text-xs font-medium text-base-content/50 mb-2">Edit source</p>
						{#if editSourceUrl}
							<div class="rounded-xl border border-base-300 bg-base-100 p-3 text-center">
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-5 mx-auto mb-1 text-success">
									<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
								</svg>
								<p class="text-xs text-base-content/60 truncate">{editSourceFileName}</p>
								<button onclick={clearEditSource} class="btn btn-xs btn-ghost text-error mt-2 gap-1">
									✕ Remove
								</button>
							</div>
						{:else}
							<label class="block cursor-pointer rounded-xl border-2 border-dashed border-base-300 hover:border-base-content/25 transition-colors">
								<div class="p-4 text-center">
									<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-5 mx-auto mb-2 text-base-content/30">
										<polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
									</svg>
									<p class="text-xs text-base-content/40 leading-tight">
										{mode === 'image' ? 'Upload image to edit' : 'Upload video to edit'}
									</p>
									{#if mode === 'video'}
										<p class="text-xs text-base-content/25 mt-1 leading-tight">Loads into canvas for editing — not a generation reference.</p>
									{/if}
								</div>
								<input
									type="file"
									accept={mode === 'image' ? 'image/*' : 'video/*'}
									class="hidden"
									onchange={handleEditSourceUpload}
									disabled={isGenerating}
								/>
							</label>
						{/if}
					</div>

					<!-- Reference images (2 cols) -->
					<div class="col-span-2">
						<div class="flex items-center justify-between mb-2">
							<p class="text-xs font-medium text-base-content/50">Reference images</p>
							<p class="text-xs text-base-content/35">{referenceFiles.length}/3 — influences generation</p>
						</div>
						<div class="grid grid-cols-3 gap-2">
							<!-- Filled slots -->
							{#each referencePreviews as preview, i (i)}
								<div class="relative rounded-lg overflow-hidden bg-base-300 h-20">
									<img src={preview} alt="ref {i + 1}" class="w-full h-full object-cover" />
									<button
										onclick={() => removeReference(i)}
										class="btn btn-xs btn-circle btn-error absolute top-1 right-1 opacity-90 shadow"
										disabled={isGenerating}
									>✕</button>
								</div>
							{/each}
							<!-- Empty slots -->
							{#each { length: 3 - referenceFiles.length } as _, i (i)}
								<label class="flex items-center justify-center h-20 rounded-lg border-2 border-dashed border-base-300 hover:border-base-content/25 transition-colors cursor-pointer {isGenerating ? 'opacity-40 pointer-events-none' : ''}">
									<span class="text-2xl text-base-content/20">+</span>
									<input
										type="file"
										accept="image/*"
										class="hidden"
										onchange={addReferenceImages}
										disabled={isGenerating}
									/>
								</label>
							{/each}
						</div>
					</div>
				</div>

				<!-- Scroll hint arrow (decorative) -->
				<div class="flex justify-center mt-4">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4 text-base-content/20">
						<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
					</svg>
				</div>

				<!-- Advanced options (video mode only) -->
				{#if mode === 'video'}
					<div class="mt-2 border-t border-base-300/50 pt-4">
						<button
							onclick={() => (showAdvanced = !showAdvanced)}
							class="flex items-center gap-2 text-xs text-base-content/40 hover:text-base-content/60 transition-colors w-full"
							disabled={isGenerating}
						>
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-3 transition-transform {showAdvanced ? 'rotate-180' : ''}">
								<polyline points="6 9 12 15 18 9"/>
							</svg>
							Advanced options
						</button>
						{#if showAdvanced}
							<div class="mt-3 grid grid-cols-2 gap-4">
								<div>
									<p class="text-xs text-base-content/40 mb-1">Duration</p>
									<select
										bind:value={duration}
										class="select select-bordered select-sm w-full text-sm"
										disabled={isGenerating}
									>
										<option value={4}>4 seconds</option>
										<option value={6}>6 seconds</option>
										<option value={8}>8 seconds</option>
									</select>
								</div>
								<div>
									<p class="text-xs text-base-content/40 mb-1">Aspect ratio</p>
									<select
										bind:value={aspectRatio}
										class="select select-bordered select-sm w-full text-sm"
										disabled={isGenerating}
									>
										<option value="16:9">16:9 — landscape</option>
										<option value="9:16">9:16 — portrait</option>
										<option value="4:3">4:3</option>
									</select>
								</div>
							</div>
						{/if}
					</div>
				{/if}

			</div>
		</div>
	</div>
</div>
