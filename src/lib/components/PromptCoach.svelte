<script lang="ts">
	import { workflowContext } from '$lib/stores/workflow.store';
	import { onMount, afterUpdate } from 'svelte';
	import { goto } from '$app/navigation';

	let userInput = '';
	let isLoading = false;
	let chatContainer: HTMLDivElement;
	let suggestedPrompts: Array<{ text: string; quality: 'draft' | 'good' | 'excellent' }> = [];
	let proTipData: string | null = null;
	let showProTipModal = false;
	let lastMessageCount = 0;

	// Quick start suggestions - most common use cases
	const quickStarts = [
		{ emoji: '👤', text: 'Create a professional avatar', type: 'avatar' },
		{ emoji: '🎨', text: 'Design a unique logo', type: 'logo' },
		{ emoji: '📱', text: 'Make social media content', type: 'social-post' },
		{ emoji: '🎬', text: 'Create an ad or promo', type: 'ad' },
		{ emoji: '💡', text: "Show me what's possible", type: 'inspiration' }
	];

	// ONLY scroll when NEW message is added, not on every update
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

		// Add user message
		workflowContext.addMessage('user', message);
		isLoading = true;

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

			if (data.error) {
				throw new Error(data.error);
			}

			// Add assistant response
			workflowContext.addMessage('assistant', data.message);

			// Update context if AI extracted info
			if (data.context) {
				workflowContext.updateContext(data.context);
			}

			// Extract and display prompts if generated (can be multiple)
			if (data.prompts && data.prompts.length > 0) {
				suggestedPrompts = data.prompts;
				workflowContext.setGeneratedPrompt(data.prompts[0].text, data.prompts[0].quality);
			}

			// Extract pro tip and show modal
			if (data.proTip) {
				proTipData = data.proTip;
				showProTipModal = true;
			}
		} catch (error) {
			console.error('Chat error:', error);
			workflowContext.addMessage(
				'assistant',
				"I'm having trouble connecting right now. Please try again in a moment!"
			);
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

	function goToCreate(promptText: string) {
		workflowContext.startCurrentStep();
		workflowContext.setGeneratedPrompt(promptText);
		const params = new URLSearchParams({
			prompt: promptText,
			from: 'coach'
		});
		goto(`/texttoimage?${params.toString()}`);
	}

	onMount(() => {
		if ($workflowContext.chatHistory.length === 0) {
			workflowContext.addMessage(
				'assistant',
				"👋 Hey! I'm your creative guide at Content Factory.\n\nI help you create world-class content - stunning avatars, professional ads, dynamic logos, and social posts that stop the scroll.\n\nWhat would you like to create today?"
			);
		}
	});
</script>

<!-- Floating Pro Tip Modal - EDUCATION CONTENT -->
{#if showProTipModal && proTipData}
	<div class="animate-fade-in fixed top-20 right-2 z-50 w-[calc(100vw-1rem)] sm:right-4 sm:w-96 sm:max-w-[calc(100vw-2rem)]">
		<div class="card border-2 border-neutral-content/30 bg-neutral shadow-2xl">
			<div class="card-body p-3 sm:p-4">
				<div class="mb-2 flex items-start justify-between">
					<div class="flex items-center gap-2">
						<span class="text-xl sm:text-2xl">📊</span>
						<div>
							<span class="text-sm font-bold text-neutral-content">Data Insight</span>
							<p class="text-xs text-neutral-content/60">Why this works</p>
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

<!-- Main Container -->
<div class="flex h-full flex-col rounded-lg bg-base-100 shadow-xl">
	<!-- Header - Fixed -->
	<div class="shrink-0 border-b border-base-300 px-3 py-2 sm:px-4 sm:py-3">
		<div class="flex items-center gap-3">
			<div class="flex h-8 w-8 items-center justify-center rounded-full bg-neutral sm:h-10 sm:w-10">
				<span class="text-lg sm:text-xl">🎨</span>
			</div>
			<div>
				<h2 class="text-sm font-semibold sm:text-base">Prompt Coach</h2>
				<p class="text-xs text-base-content/60">Your AI creative partner</p>
			</div>
		</div>
	</div>

	<!-- Messages Area - SCROLLABLE -->
	<div
		bind:this={chatContainer}
		class="flex-1 space-y-3 overflow-y-auto p-2 sm:p-4"
		style="max-height: calc(100vh - 250px);"
	>
		<!-- Quick Start Buttons (only at start) -->
		{#if $workflowContext.chatHistory.length === 1}
			<div class="mb-4 space-y-2">
				<p class="text-xs text-base-content/60">Quick starts:</p>
				<div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
					{#each quickStarts as suggestion}
						<button
							on:click={() => handleQuickStart(suggestion)}
							class="btn btn-xs sm:btn-sm md:btn-md lg:btn-lg xl:btn-xl btn-neutral "
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
				<!-- Avatar -->
				<div class="shrink-0">
					<div class="avatar">
						<div class="w-6 rounded-full sm:w-7 {message.role === 'user' ? 'bg-neutral' : 'bg-base-300'}">
							<span class="flex h-full items-center justify-center text-xs sm:text-sm">
								{message.role === 'user' ? '👤' : 'AI'}
							</span>
						</div>
					</div>
				</div>

				<!-- Message Bubble -->
				<div
					class="max-w-[85%] rounded-lg px-3 py-2 text-sm sm:max-w-[75%] {message.role === 'user'
						? 'bg-neutral text-neutral-content'
						: 'bg-base-200 text-base-content'}"
				>
					<p class="leading-relaxed whitespace-pre-wrap">{message.content}</p>
				</div>
			</div>
		{/each}

		<!-- Loading Indicator -->
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

		<!-- Multiple Suggested Prompts -->
		{#if suggestedPrompts.length > 0}
			<div class="mt-4 space-y-2">
				<div class="flex items-center gap-2">
					<span>✨</span>
					<span class="text-sm font-semibold">Expert Prompt Options</span>
				</div>

				{#each suggestedPrompts as prompt, index}
					<div class="w-full rounded-lg border border-success/30 bg-success/10 p-2 sm:max-w-[60%] sm:p-3">
						<div class="mb-2 flex items-center justify-between">
							<div class="flex items-center gap-2">
								<span class="badge badge-xs badge-success">#{index + 1}</span>
								{#if prompt.quality === 'excellent'}
									<span class="badge badge-xs badge-info">Excellent</span>
								{:else if prompt.quality === 'good'}
									<span class="badge badge-ghost badge-xs">Good</span>
								{/if}
							</div>
							<button on:click={(e) => copyPrompt(prompt.text, e)} class="btn btn-ghost btn-xs">
								📋 <span class="ml-1 hidden sm:inline">Copy</span>
							</button>
						</div>
						<p class="mb-2 text-xs leading-relaxed">{prompt.text}</p>
						<button
							on:click={() => goToCreate(prompt.text)}
							class="btn btn-block btn-xs btn-success"
						>
							🎨 Quick Apply
						</button>
					</div>
				{/each}
			</div>
		{/if}

		<!-- Workflow Hint -->
		{#if $workflowContext.contentType && suggestedPrompts.length === 0}
			<div class="w-full rounded-lg border border-info/30 bg-info/10 p-2 sm:max-w-[60%]">
				<p class="text-xs text-info">
					💡 Once we create your {$workflowContext.contentType}, we'll refine it to perfection, then
					bring it to life!
				</p>
			</div>
		{/if}
	</div>

	<!-- Input Area - Fixed at Bottom -->
	<div class="shrink-0 border-t border-base-300 p-2 sm:p-3">
		<form on:submit|preventDefault={sendMessage} class="w-full">
			<div class="flex items-end gap-2">
				<textarea
					bind:value={userInput}
					on:keydown={handleKeyPress}
					placeholder="What do you want to create?"
					disabled={isLoading}
					class="textarea-bordered textarea w-full flex-1 resize-y bg-base-200 text-sm textarea-sm focus:outline-neutral disabled:opacity-50"
					rows="1"
					style="min-height: 50px; max-height: 200px;"
				></textarea>
				<button
					type="submit"
					disabled={isLoading || !userInput.trim()}
					class="btn shrink-0 px-3 btn-sm btn-neutral sm:px-4"
				>
					{#if isLoading}
						<span class="loading loading-xs loading-spinner"></span>
					{:else}
						<span>Send</span>
					{/if}
				</button>
			</div>
			<p class="mt-1 hidden text-xs text-base-content/40 sm:block">
				💡 Describe what you want to create (Shift+Enter for new line)
			</p>
		</form>
	</div>
</div>

<style>
	/* Smooth scroll behavior */
	.overflow-y-auto {
		scroll-behavior: smooth;
	}

	/* Custom scrollbar */
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

	/* Fade in animation for modal */
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