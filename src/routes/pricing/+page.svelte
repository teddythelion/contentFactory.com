<!-- src/routes/pricing/+page.svelte -->
<!-- Starfield pricing page — tier colors: Starter blue, Pro purple, Elite gold.
     All numbers come from TIER_CONFIG so the page can never drift from what the
     server enforces. CTA signs in (Google) inline if needed, then goes to Stripe. -->
<script lang="ts">
	import { TIER_CONFIG } from '$lib/types/subscription';
	import { authStore } from '$lib/stores/auth.store';
	import { subscriptionStore } from '$lib/stores/subscription.store';

	const starter = TIER_CONFIG.starter;
	const pro = TIER_CONFIG.pro;
	const elite = TIER_CONFIG.elite;

	let busy = $state<string | null>(null);
	let currentPlan = $derived($subscriptionStore.plan);

	async function choosePlan(plan: 'starter' | 'pro' | 'elite') {
		if (busy) return;
		if (!$authStore.user) {
			const result = await authStore.signInWithGoogle();
			if (!result?.success) return;
		}
		busy = plan;
		try {
			const res = await fetch('/api/stripe/checkout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ plan })
			});
			const data = await res.json();
			if (data.url) {
				window.location.href = data.url;
			} else {
				console.error('💸 Checkout returned no URL:', data);
				alert(`Could not start checkout: ${data.error ?? 'unknown error'}. Please try again.`);
				busy = null;
			}
		} catch (err) {
			console.error('💸 Checkout failed:', err);
			alert('Could not start checkout — please try again.');
			busy = null;
		}
	}

	async function manageSubscription() {
		if (busy) return;
		busy = 'portal';
		try {
			const res = await fetch('/api/stripe/portal', { method: 'POST' });
			const data = await res.json();
			if (data.url) window.location.href = data.url;
			else {
				console.error('💸 Portal returned no URL:', data);
				busy = null;
			}
		} catch (err) {
			console.error('💸 Portal failed:', err);
			busy = null;
		}
	}

	function gb(bytes: number): string {
		return `${Math.round(bytes / 1073741824)} GB`;
	}
</script>

<svelte:head>
	<title>Pricing — Content Factory</title>
	<meta name="description" content="One studio for AI video, images, music, voice and editing. Pick your production capacity." />
</svelte:head>

<div class="starfield min-h-screen px-4 py-16 sm:py-20">
	<!-- Heading -->
	<div class="mx-auto mb-12 max-w-2xl text-center">
		<h1 class="mb-4 text-5xl font-black tracking-tight sm:text-6xl">
			<span class="bg-gradient-to-r from-blue-400 via-purple-400 to-amber-300 bg-clip-text text-transparent">Pricing</span>
		</h1>
		<p class="text-base text-base-content/60 sm:text-lg">
			One studio for AI video, images, music, voice and a full timeline editor.
			Pick your production capacity — everything else is included in every plan.
		</p>
	</div>

	<!-- Cards -->
	<div class="mx-auto grid max-w-6xl grid-cols-1 items-stretch gap-6 lg:grid-cols-3 lg:gap-8">

		<!-- STARTER — blue -->
		<div class="tier-card starter-card flex flex-col rounded-2xl p-8">
			<p class="mb-1 text-sm font-semibold tracking-widest text-blue-300/80 uppercase">Starter</p>
			<div class="mb-1 flex items-end gap-2">
				<span class="text-5xl font-black text-white">${starter.priceUsd}</span>
				<span class="mb-2 text-sm text-base-content/50">/ month</span>
			</div>
			<p class="mb-6 text-xs text-base-content/50">For consistent social output</p>
			<ul class="mb-8 flex-1 space-y-3 text-sm">
				<li class="tick">{starter.maxVideos} AI videos every month</li>
				<li class="tick">{starter.maxImages} AI images — up to {starter.maxImageSize}, {starter.maxImageVariants} variants per prompt</li>
				<li class="tick">Full 3D studio & multi-track timeline editor</li>
				<li class="tick">AI music, sound effects & voice tools</li>
				<li class="tick">{gb(starter.storageLimit)} content library</li>
			</ul>
			{#if currentPlan === 'starter'}
				<button class="pill-btn border-blue-400/60 text-blue-200" onclick={manageSubscription} disabled={busy !== null}>
					{busy === 'portal' ? 'Opening…' : 'Current plan — Manage'}
				</button>
			{:else}
				<button class="pill-btn border-blue-400/60 text-blue-100 hover:bg-blue-500/10" onclick={() => choosePlan('starter')} disabled={busy !== null}>
					{busy === 'starter' ? 'Starting checkout…' : `Get Starter — $${starter.priceUsd}/mo`} <span aria-hidden="true">›</span>
				</button>
			{/if}
		</div>

		<!-- PRO — purple, elevated -->
		<div class="tier-card pro-card relative flex flex-col rounded-2xl p-8 lg:-translate-y-4">
			<span class="badge-float bg-purple-500/90">Most Popular</span>
			<p class="mb-1 text-sm font-semibold tracking-widest text-purple-200/90 uppercase">Pro</p>
			<div class="mb-1 flex items-end gap-2">
				<span class="text-5xl font-black text-white">${pro.priceUsd}</span>
				<span class="mb-2 text-sm text-white/50">/ month</span>
			</div>
			<p class="mb-6 text-xs text-white/50">For creators shipping daily</p>
			<ul class="mb-8 flex-1 space-y-3 text-sm">
				<li class="tick">{pro.maxVideos} AI videos + <strong>{pro.maxPremiumVideos} premium credits</strong></li>
				<li class="tick">Premium credits buy cinema-grade generations or video extensions</li>
				<li class="tick">{pro.maxImages} AI images — up to {pro.maxImageSize}, {pro.maxImageVariants} variants, premium image model</li>
				<li class="tick">Full 3D studio & multi-track timeline editor</li>
				<li class="tick">AI music, sound effects & voice tools</li>
				<li class="tick">{gb(pro.storageLimit)} content library</li>
			</ul>
			{#if currentPlan === 'pro'}
				<button class="pill-btn border-purple-300/70 text-purple-100" onclick={manageSubscription} disabled={busy !== null}>
					{busy === 'portal' ? 'Opening…' : 'Current plan — Manage'}
				</button>
			{:else}
				<button class="pill-btn border-purple-300/70 bg-purple-500/20 text-white hover:bg-purple-500/30" onclick={() => choosePlan('pro')} disabled={busy !== null}>
					{busy === 'pro' ? 'Starting checkout…' : `Get Pro — $${pro.priceUsd}/mo`} <span aria-hidden="true">›</span>
				</button>
			{/if}
		</div>

		<!-- ELITE — gold -->
		<div class="tier-card elite-card relative flex flex-col rounded-2xl p-8">
			<span class="badge-float bg-gradient-to-r from-amber-500 to-yellow-400 text-black">The Full Studio</span>
			<p class="mb-1 text-sm font-semibold tracking-widest text-amber-300/90 uppercase">Elite</p>
			<div class="mb-1 flex items-end gap-2">
				<span class="bg-gradient-to-b from-amber-200 to-amber-400 bg-clip-text text-5xl font-black text-transparent">${elite.priceUsd}</span>
				<span class="mb-2 text-sm text-base-content/50">/ month</span>
			</div>
			<p class="mb-6 text-xs text-base-content/50">The complete AI production house</p>
			<ul class="mb-8 flex-1 space-y-3 text-sm">
				<li class="tick gold">{elite.maxVideos} AI videos + <strong>{elite.maxPremiumVideos} premium credits</strong></li>
				<li class="tick gold">Long-form, broadcast-ready cuts via premium extensions</li>
				<li class="tick gold">{elite.maxImages} AI images — up to {elite.maxImageSize}, premium image model</li>
				<li class="tick gold">Every tool in the studio — idea to finished video, one app</li>
				<li class="tick gold">{gb(elite.storageLimit)} content library</li>
			</ul>
			{#if currentPlan === 'elite'}
				<button class="pill-btn border-amber-400/70 text-amber-200" onclick={manageSubscription} disabled={busy !== null}>
					{busy === 'portal' ? 'Opening…' : 'Current plan — Manage'}
				</button>
			{:else}
				<button class="pill-btn border-amber-400/70 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25" onclick={() => choosePlan('elite')} disabled={busy !== null}>
					{busy === 'elite' ? 'Starting checkout…' : `Get Elite — $${elite.priceUsd}/mo`} <span aria-hidden="true">›</span>
				</button>
			{/if}
		</div>
	</div>

	<!-- Quiet free path — deliberately understated -->
	<p class="mt-10 text-center text-xs text-base-content/40">
		Just exploring? <a href="/create" class="link link-hover text-base-content/60">Try the studio first</a> — no credit card required.
	</p>
</div>

<style>
	/* Layered star dots — three tiled sizes for depth, like the reference */
	.starfield {
		background-color: #07090f;
		background-image:
			radial-gradient(1px 1px at 25px 45px, rgba(255, 255, 255, 0.45) 50%, transparent 51%),
			radial-gradient(1px 1px at 155px 130px, rgba(255, 255, 255, 0.3) 50%, transparent 51%),
			radial-gradient(1.5px 1.5px at 90px 210px, rgba(180, 200, 255, 0.35) 50%, transparent 51%),
			radial-gradient(1px 1px at 220px 80px, rgba(255, 255, 255, 0.25) 50%, transparent 51%),
			radial-gradient(2px 2px at 320px 260px, rgba(255, 255, 255, 0.18) 50%, transparent 51%),
			radial-gradient(1px 1px at 380px 160px, rgba(220, 200, 255, 0.3) 50%, transparent 51%);
		background-size: 420px 420px;
	}

	.tier-card {
		border: 1px solid rgba(255, 255, 255, 0.08);
		backdrop-filter: blur(6px);
		transition: transform 0.25s ease, box-shadow 0.25s ease;
	}
	.tier-card:hover {
		transform: translateY(-4px);
	}
	.pro-card:hover {
		transform: translateY(-1.35rem);
	}

	.starter-card {
		background: linear-gradient(165deg, rgba(37, 99, 235, 0.16), rgba(10, 14, 26, 0.75) 55%);
		border-color: rgba(96, 165, 250, 0.22);
	}
	.starter-card:hover {
		box-shadow: 0 16px 48px rgba(37, 99, 235, 0.18);
	}

	.pro-card {
		background: linear-gradient(165deg, rgba(147, 51, 234, 0.42), rgba(88, 28, 135, 0.22) 45%, rgba(10, 14, 26, 0.8));
		border-color: rgba(196, 145, 250, 0.35);
		box-shadow: 0 20px 60px rgba(147, 51, 234, 0.22);
	}
	.pro-card:hover {
		box-shadow: 0 28px 72px rgba(147, 51, 234, 0.32);
	}

	.elite-card {
		background: linear-gradient(165deg, rgba(245, 158, 11, 0.2), rgba(120, 53, 15, 0.12) 50%, rgba(10, 14, 26, 0.8));
		border-color: rgba(251, 191, 36, 0.32);
	}
	.elite-card:hover {
		box-shadow: 0 16px 48px rgba(245, 158, 11, 0.2);
	}

	.badge-float {
		position: absolute;
		top: -0.8rem;
		left: 50%;
		transform: translateX(-50%);
		padding: 0.25rem 0.9rem;
		border-radius: 9999px;
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		white-space: nowrap;
		color: white;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
	}

	.tick {
		position: relative;
		padding-left: 1.75rem;
		color: rgba(255, 255, 255, 0.82);
	}
	.tick::before {
		content: '✓';
		position: absolute;
		left: 0;
		top: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.1rem;
		height: 1.1rem;
		border-radius: 9999px;
		background: rgba(255, 255, 255, 0.12);
		color: #fff;
		font-size: 0.65rem;
		font-weight: 900;
	}
	.tick.gold::before {
		background: rgba(245, 158, 11, 0.25);
		color: #fbbf24;
	}

	.pill-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		width: 100%;
		padding: 0.7rem 1.25rem;
		border-radius: 9999px;
		border-width: 1px;
		border-style: solid;
		font-size: 0.875rem;
		font-weight: 700;
		background-color: rgba(255, 255, 255, 0.04);
		cursor: pointer;
		transition: background 0.2s ease, transform 0.15s ease;
	}
	.pill-btn:hover:not(:disabled) {
		transform: translateY(-1px);
	}
	.pill-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
