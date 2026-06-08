<script lang="ts">
	import { workflowContext } from '$lib/stores/workflow.store';
	import { authStore } from '$lib/stores/auth.store';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AuthModal from '$lib/components/AuthModal.svelte';

	let userInput = $state('');
	let isLoading = $state(false);
	let chatContainer = $state<HTMLDivElement>();
	let suggestedPrompts = $state<Array<{ text: string; quality: 'draft' | 'good' | 'excellent' }>>([]);
	let proTipData = $state<string | null>(null);
	let showProTipModal = $state(false);
	let showAuthToast = $state(false);
	let showAuthModal = $state(false);
	let lastMessageCount = $state(0);
	let thinkingWord = $state('Analyzing');
	let thinkingInterval: ReturnType<typeof setInterval> | null = null;

	const thinkingWords = [
		'Analyzing', 'Reasoning', 'Processing', 'Evaluating', 'Computing',
		'Researching', 'Investigating', 'Cross-referencing', 'Sourcing', 'Mining data',
		'Interpreting', 'Parsing', 'Contextualizing', 'Mapping', 'Profiling',
		'Engineering', 'Crafting', 'Formulating', 'Calibrating', 'Structuring'
	];

	function startThinking() {
		thinkingWord = thinkingWords[Math.floor(Math.random() * thinkingWords.length)];
		thinkingInterval = setInterval(() => {
			thinkingWord = thinkingWords[Math.floor(Math.random() * thinkingWords.length)];
		}, 1500);
	}

	function stopThinking() {
		if (thinkingInterval) {
			clearInterval(thinkingInterval);
			thinkingInterval = null;
		}
	}

	const quickStarts = [
		{ emoji: '👤', text: 'Professional avatar', type: 'avatar' },
		{ emoji: '🎨', text: 'Logo design', type: 'logo' },
		{ emoji: '📱', text: 'Social media post', type: 'social-post' },
		{ emoji: '🎬', text: 'Ad or promo video', type: 'ad' },
		{ emoji: '💡', text: "Show me what's possible", type: 'inspiration' }
	];

	$effect(() => {
		if ($workflowContext.chatHistory.length > lastMessageCount && chatContainer) {
			lastMessageCount = $workflowContext.chatHistory.length;
			setTimeout(() => {
				chatContainer.scrollTop = chatContainer.scrollHeight;
			}, 100);
		}
	});

	async function sendMessage() {
		if (!$authStore.user) {
			showAuthToast = true;
			setTimeout(() => { showAuthToast = false; }, 6000);
			return;
		}
		if (!userInput.trim() || isLoading) return;

		const message = userInput.trim();
		userInput = '';
		workflowContext.addMessage('user', message);
		isLoading = true;
		startThinking();

		try {
			const response = await fetch('/api/prompt-coach', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					messages: $workflowContext.chatHistory.map((msg) => ({
						role: msg.role,
						content: msg.content
					})),
					context: {
						contentType: $workflowContext.contentType,
						userIntent: $workflowContext.userIntent,
						style: $workflowContext.style,
						purpose: $workflowContext.purpose,
						targetAudience: $workflowContext.targetAudience
					}
				})
			});

			const data = await response.json();
			if (data.error) throw new Error(data.error);

			workflowContext.addMessage('assistant', data.message);

			if (data.context) workflowContext.updateContext(data.context);

			if (data.prompts && data.prompts.length > 0) {
				suggestedPrompts = data.prompts;
				workflowContext.setGeneratedPrompt(data.prompts[0].text, data.prompts[0].quality);
			}

			if (data.proTip) {
				proTipData = data.proTip;
				showProTipModal = true;
			}
		} catch (error) {
			workflowContext.addMessage('assistant', "I'm having trouble connecting right now. Please try again in a moment.");
		} finally {
			isLoading = false;
			stopThinking();
		}
	}

	function handleQuickStart(suggestion: (typeof quickStarts)[0]) {
		userInput = suggestion.text;
		sendMessage();
	}

	function handleKeyPress(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			sendMessage();
		}
	}

	function copyPrompt(promptText: string, event: MouseEvent) {
		navigator.clipboard.writeText(promptText);
		const btn = event?.target as HTMLButtonElement;
		if (btn) {
			const orig = btn.textContent;
			btn.textContent = '✓ Copied!';
			setTimeout(() => { btn.textContent = orig; }, 2000);
		}
	}

	function goToCreate(promptText: string) {
		workflowContext.startCurrentStep();
		workflowContext.setGeneratedPrompt(promptText);
		const params = new URLSearchParams({ prompt: ` ${promptText} - Add your NICHE/INDUSTRY `, from: 'coach' });
		goto(resolve('/create') + `?${params.toString()}`);
	}

	onMount(() => {
		if ($workflowContext.chatHistory.length === 0) {
			workflowContext.addMessage(
				'assistant',
				"Hi, I'm your Prompt Engineer.\n\nI research your niche, study what's working in your industry, and craft scientifically-optimized prompts that produce content your audience actually stops for.\n\nWhether you're building a brand, launching a product, or just need something that stands out — tell me what you're creating and who it's for. I'll do the rest."
			);
		}
	});
</script>

<AuthModal bind:isOpen={showAuthModal} />

<!-- Auth toast -->
{#if showAuthToast}
	<div class="toast toast-top toast-center z-[9999]">
		<div class="alert alert-warning flex flex-col gap-2 max-w-sm shadow-2xl">
			<div class="flex items-center gap-2">
				<span class="text-2xl">🔒</span>
				<div>
					<p class="font-bold">Sign in required</p>
					<p class="text-sm">You need to be signed in to use the Prompt Engineer.</p>
				</div>
				<button onclick={() => showAuthToast = false} class="btn btn-ghost btn-xs ml-auto">✕</button>
			</div>
			<button onclick={() => { showAuthModal = true; showAuthToast = false; }} class="btn btn-primary btn-sm w-full">
				Sign In Now
			</button>
		</div>
	</div>
{/if}

<!-- Pro Tip Modal -->
{#if showProTipModal && proTipData}
	<div class="fixed top-20 right-2 z-50 w-[calc(100vw-1rem)] sm:right-4 sm:w-96">
		<div class="card border border-secondary/30 bg-base-300 shadow-2xl">
			<div class="card-body p-4">
				<div class="mb-2 flex items-start justify-between">
					<div class="flex items-center gap-2">
						<span class="text-xl">📊</span>
						<div>
							<p class="text-sm font-bold text-secondary">Research Insight</p>
							<p class="text-xs opacity-50">Why this works</p>
						</div>
					</div>
					<button onclick={() => (showProTipModal = false)} class="btn btn-circle btn-ghost btn-xs">✕</button>
				</div>
				<p class="text-sm leading-relaxed whitespace-pre-wrap opacity-90">{proTipData}</p>
			</div>
		</div>
	</div>
{/if}

<!-- Main Card -->
<div class="mx-auto flex w-full max-w-4xl flex-col rounded-xl border border-base-300 bg-base-200 shadow-xl" style="height: calc(100vh - 120px);">

	<!-- Header -->
	<div class="flex shrink-0 items-center gap-3 border-b border-base-300 px-4 py-3">
		<div class="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/20">
			<span class="text-lg">⚙️</span>
		</div>
		<div>
			<h2 class="text-sm font-bold sm:text-base">Prompt Engineer</h2>
			<p class="text-xs opacity-50">Niche research · Audience psychology · Optimized prompts</p>
		</div>
		{#if suggestedPrompts.length > 0}
			<button onclick={() => { suggestedPrompts = []; }} class="btn btn-ghost btn-xs ml-auto opacity-50">Clear</button>
		{/if}
	</div>

	<!-- Chat Area -->
	<div bind:this={chatContainer} class="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">

		<!-- Quick starts (first message only) -->
		{#if $workflowContext.chatHistory.length === 1}
			<div class="flex flex-wrap gap-2 pb-1">
				{#each quickStarts as s}
					<button
						onclick={() => handleQuickStart(s)}
						class="btn btn-xs btn-outline border-base-300 hover:btn-secondary"
					>
						<span>{s.emoji}</span>
						<span>{s.text}</span>
					</button>
				{/each}
			</div>
		{/if}

		<!-- Messages -->
		{#each $workflowContext.chatHistory as message, i (i)}
			<div class="flex gap-2 {message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}">
				<!-- Avatar -->
				<div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold
					{message.role === 'user' ? 'bg-neutral text-neutral-content' : 'bg-secondary/20 text-secondary'}">
					{message.role === 'user' ? '👤' : '⚙️'}
				</div>
				<!-- Bubble -->
				<div class="max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap
					{message.role === 'user'
						? 'rounded-tr-sm bg-neutral text-neutral-content'
						: 'rounded-tl-sm bg-base-100 text-base-content'}">
					{message.content}
				</div>
			</div>
		{/each}

		<!-- Loading -->
		{#if isLoading}
			<div class="flex gap-2">
				<div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary/20 text-xs text-secondary">⚙️</div>
				<div class="rounded-2xl rounded-tl-sm bg-base-100 px-3 py-2">
					<span class="text-xs font-medium text-secondary opacity-80">{thinkingWord}<span class="animate-pulse">…</span></span>
				</div>
			</div>
		{/if}

		<!-- Suggested Prompts -->
		{#if suggestedPrompts.length > 0}
			<div class="space-y-2 pt-1">
				<p class="flex items-center gap-1 text-xs font-semibold opacity-60">
					<span>✨</span> Engineered prompts — add your niche before using
				</p>
				{#each suggestedPrompts as prompt, index (index)}
					<div class="rounded-xl border border-secondary/20 bg-base-100 p-3">
						<div class="mb-2 flex items-center gap-2">
							<span class="badge badge-xs badge-secondary">#{index + 1}</span>
							{#if prompt.quality === 'excellent'}
								<span class="badge badge-xs badge-accent">Excellent</span>
							{:else if prompt.quality === 'good'}
								<span class="badge badge-xs badge-ghost">Good</span>
							{/if}
							<button onclick={(e) => copyPrompt(prompt.text, e)} class="btn btn-ghost btn-xs ml-auto">
								📋 Copy
							</button>
						</div>
						<p class="mb-3 text-xs leading-relaxed opacity-80">{prompt.text}</p>
						<button onclick={() => goToCreate(prompt.text)} class="btn btn-secondary btn-xs btn-block">
							🎨 Use in Studio
						</button>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Input -->
	<div class="shrink-0 border-t border-base-300 p-3">
		<form onsubmit={(e) => { e.preventDefault(); sendMessage(); }} class="flex items-end gap-2">
			<textarea
				bind:value={userInput}
				onkeydown={handleKeyPress}
				placeholder="e.g. Create a promo video for my coffee shop targeting millennials..."
				disabled={isLoading}
				rows="2"
				class="textarea textarea-bordered w-full flex-1 resize-none bg-base-100 text-sm focus:outline-secondary disabled:opacity-50"
				style="max-height: 120px;"
			></textarea>
			<button
				type="submit"
				disabled={isLoading || !userInput.trim()}
				class="btn btn-secondary btn-sm shrink-0"
			>
				{#if isLoading}
					<span class="loading loading-spinner loading-xs"></span>
				{:else}
					Send
				{/if}
			</button>
		</form>
		<p class="mt-1 text-xs opacity-30">Shift+Enter for new line</p>
	</div>
</div>
