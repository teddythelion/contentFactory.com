<script lang="ts">
	import { workflowContext } from '$lib/stores/workflow.store';
	import { onMount } from 'svelte';

	// Props to customize for Refine stage
	export let onPromptSelected: (prompt: string) => void = () => {};
	// svelte-ignore export_let_unused
	export let stage: 'refine' = 'refine';

	let userInput = '';
	let isLoading = false;
	let chatContainer: HTMLDivElement;
	let suggestedPrompts: Array<{ text: string; quality: 'draft' | 'good' | 'excellent' }> = [];
	let proTipData: string | null = null;
	let showProTipModal = false;
	let lastMessageCount = 0;

	// Quick start suggestions for REFINE stage
	const quickStarts = [
		{ emoji: '✨', text: 'Enhance to photorealistic quality', type: 'enhance' },
		{ emoji: '💡', text: 'Add professional lighting', type: 'lighting' },
		{ emoji: '🎨', text: 'Improve details and resolution', type: 'detail' },
		{ emoji: '📸', text: 'Studio photography quality', type: 'studio' },
		{ emoji: '💎', text: 'What makes great refinement?', type: 'tips' }
	];

	// ONLY scroll when NEW message is added
	$: if ($workflowContext.chatHistory.length > lastMessageCount && chatContainer) {
		lastMessageCount = $workflowContext.chatHistory.length;
		setTimeout(() => {
			chatContainer.scrollTop = chatContainer.scrollHeight;
		}, 100);
	}

	async function sendMessage() {
		if (!userInput.trim() || isLoading) return;

		const message = userInput.trim();
		userInput = '';

		workflowContext.addMessage('user', message);
		isLoading = true;

		try {
			const response = await fetch('/api/prompt-coach-refine', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					messages: $workflowContext.chatHistory.map((msg) => ({
						role: msg.role,
						content: msg.content
					})),
					stage: 'refine',
					context: {
						contentType: $workflowContext.contentType,
						userIntent: $workflowContext.userIntent,
						style: $workflowContext.style,
						purpose: $workflowContext.purpose
					}
				})
			});

			const data = await response.json();

			if (data.error) {
				throw new Error(data.error);
			}

			workflowContext.addMessage('assistant', data.message);

			if (data.context) {
				workflowContext.updateContext(data.context);
			}

			if (data.prompts && data.prompts.length > 0) {
				suggestedPrompts = data.prompts;
			}

			if (data.proTip) {
				proTipData = data.proTip;
				showProTipModal = true;
			}
		} catch (error) {
			console.error('Chat error:', error);
			workflowContext.addMessage('assistant', "I'm having trouble connecting. Please try again!");
		} finally {
			isLoading = false;
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
			const originalText = btn.textContent;
			btn.textContent = '✓ Copied!';
			setTimeout(() => {
				btn.textContent = originalText;
			}, 2000);
		}
	}

	function usePrompt(promptText: string) {
		// Call the parent's callback to insert prompt into textarea
		onPromptSelected(promptText);

		// Clear suggested prompts after use
		suggestedPrompts = [];
	}

	onMount(() => {
		if ($workflowContext.chatHistory.length === 0) {
			workflowContext.addMessage(
				'assistant',
				"👋 I'm your Refine coach and prompt engineer \n\nI help you create technical refinement prompts that add photorealistic and high resolution video perfection while preserving artistic and or professional uniqueness.\n\nWhat type of outcomes are you looking for?"
			);
		}
	});
</script>

<!-- Floating Pro Tip Modal -->
{#if showProTipModal && proTipData}
	<div class="animate-fade-in fixed top-20 right-4 z-50 w-96 max-w-[calc(100vw-2rem)]">
		<div class="card border-2 border-neutral-content/30 bg-neutral shadow-2xl">
			<div class="card-body p-4">
				<div class="mb-2 flex items-start justify-between">
					<div class="flex items-center gap-2">
						<span class="text-2xl">📊</span>
						<div>
							<span class="text-sm font-bold text-neutral-content">Prompt Insights</span>
							<p class="text-xs text-neutral-content/60">Technical guidance</p>
						</div>
					</div>
					<button
						on:click={() => (showProTipModal = false)}
						class="btn btn-circle btn-ghost btn-xs"
					>
						✕
					</button>
				</div>
				<div class="prose prose-sm max-w-none text-neutral-content/90">
					<p class="text-sm leading-relaxed whitespace-pre-wrap">{proTipData}</p>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Chat Container -->
<div class="flex h-full flex-col rounded-lg bg-base-100">
	<!-- Header -->
	<div class="shrink-0 border-b border-base-300 px-4 py-3">
		<div class="flex items-center gap-3">
			<div class="flex h-10 w-10 items-center justify-center rounded-full bg-neutral">
				<span class="text-xl">✨</span>
			</div>
			<div>
				<h2 class="text-base font-semibold">Prompt Coach</h2>
				<p class="text-xs text-base-content/60">Photorealistic enhancement expert</p>
			</div>
		</div>
	</div>

	<!-- Messages Area - SCROLLABLE -->
	<div
		bind:this={chatContainer}
		class="flex-1 space-y-3 overflow-y-auto p-4"
		style="max-height: 500px;"
	>
		<!-- Quick Start Buttons -->
		{#if $workflowContext.chatHistory.length === 1}
			<div class="mb-4 space-y-2">
				<p class="text-xs text-base-content/60">Quick refinements:</p>
				<div class="flex flex-wrap gap-2">
					{#each quickStarts as suggestion}
						<button
							on:click={() => handleQuickStart(suggestion)}
							class="btn gap-1 btn-outline btn-xs hover:btn-neutral"
						>
							<span class="text-sm">{suggestion.emoji}</span>
							<span class="text-xs">{suggestion.text}</span>
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Chat Messages -->
		{#each $workflowContext.chatHistory as message}
			<div class="flex gap-2 {message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}">
				<div class="shrink-0">
					<div class="avatar">
						<div class="w-7 rounded-full {message.role === 'user' ? 'bg-neutral' : 'bg-base-300'}">
							<span class="flex h-full items-center justify-center text-sm">
								{message.role === 'user' ? '👤' : '✨'}
							</span>
						</div>
					</div>
				</div>

				<div
					class="max-w-[75%] rounded-lg px-3 py-2 text-sm {message.role === 'user'
						? 'bg-neutral text-neutral-content'
						: 'bg-base-200 text-base-content'}"
				>
					<p class="leading-relaxed whitespace-pre-wrap">{message.content}</p>
				</div>
			</div>
		{/each}

		<!-- Loading -->
		{#if isLoading}
			<div class="flex justify-start">
				<div class="rounded-lg bg-base-200 px-3 py-2">
					<div class="flex items-center gap-2">
						<span class="loading loading-sm loading-dots"></span>
						<span class="text-xs text-base-content/60">Thinking...</span>
					</div>
				</div>
			</div>
		{/if}

		<!-- Suggested Prompts -->
		{#if suggestedPrompts.length > 0}
			<div class="mt-4 space-y-2">
				<div class="flex items-center gap-2">
					<span>✨</span>
					<span class="text-sm font-semibold">Refinement Prompt Options</span>
				</div>

				{#each suggestedPrompts as prompt, index}
					<div class="rounded-lg border border-success/30 bg-success/10 p-3">
						<div class="mb-2 flex items-center justify-between">
							<div class="flex items-center gap-2">
								<span class="badge badge-xs badge-success">#{index + 1}</span>
								{#if prompt.quality === 'excellent'}
									<span class="badge badge-xs badge-info">Excellent</span>
								{/if}
							</div>
							<button on:click={(e) => copyPrompt(prompt.text, e)} class="btn btn-ghost btn-xs">
								📋
							</button>
						</div>
						<p class="mb-2 text-xs leading-relaxed">{prompt.text}</p>
						<button
							on:click={() => usePrompt(prompt.text)}
							class="btn btn-block btn-xs btn-success"
						>
							✨ Use This Prompt
						</button>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Input Area -->
	<div class="shrink-0 border-t border-base-300 p-3">
		<form on:submit|preventDefault={sendMessage} class="max-w-full">
			<div class="flex items-end gap-2">
				<textarea
					bind:value={userInput}
					on:keydown={handleKeyPress}
					placeholder="What refinements do you need?"
					disabled={isLoading}
					class="textarea-bordered textarea flex-1 resize-y bg-base-200 text-sm textarea-sm focus:outline-neutral disabled:opacity-50"
					rows="1"
					style="min-height: 38px; max-height: 150px;"
				></textarea>
				<button
					type="submit"
					disabled={isLoading || !userInput.trim()}
					class="btn shrink-0 px-4 btn-sm btn-neutral"
				>
					{#if isLoading}
						<span class="loading loading-xs loading-spinner"></span>
					{:else}
						<span>Send</span>
					{/if}
				</button>
			</div>
			<p class="mt-1 text-xs text-base-content/40">
				💡 Describe technical improvements (Shift+Enter for new line)
			</p>
		</form>
	</div>
</div>

<style>
	.overflow-y-auto {
		scroll-behavior: smooth;
	}

	:global(.overflow-y-auto::-webkit-scrollbar) {
		width: 6px;
	}

	:global(.overflow-y-auto::-webkit-scrollbar-track) {
		background: transparent;
	}

	:global(.overflow-y-auto::-webkit-scrollbar-thumb) {
		background: hsl(var(--bc) / 0.2);
		border-radius: 3px;
	}

	:global(.overflow-y-auto::-webkit-scrollbar-thumb:hover) {
		background: hsl(var(--bc) / 0.3);
	}

	@keyframes fade-in {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.animate-fade-in {
		animation: fade-in 0.3s ease-out;
	}
</style>
