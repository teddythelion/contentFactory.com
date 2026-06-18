<script lang="ts">
	// Marketing Page — Content Factory
	// Svelte 5 runes mode — no $:, no on:event, keyed {#each}
</script>

<div class="min-h-screen bg-base-100">
	<!-- Hero -->
	<div class="relative overflow-hidden border-b border-white/5 bg-base-200 px-6 py-20 text-center">
		<div
			class="pointer-events-none absolute inset-0 opacity-5"
			style="background-image: linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px); background-size: 40px 40px;"
		></div>
		<div class="relative z-10 mx-auto max-w-3xl">
			<div
				class="mb-4 inline-block rounded-full border border-info/30 bg-info/10 px-4 py-1.5 text-xs font-semibold tracking-widest text-info uppercase"
			>
				Marketing
			</div>
			<h1 class="mb-6 text-4xl leading-tight font-black text-white md:text-6xl">
				Market Like a Studio.<br />
				<span class="text-info">Spend Like a Startup.</span>
			</h1>
			<p class="mx-auto max-w-2xl text-lg text-white/60">
				Content Factory gives you a complete marketing content production pipeline — without an
				agency, without a team, without a massive budget.
			</p>
		</div>
	</div>

	<div class="mx-auto max-w-7xl px-6 py-20">
		<!-- The Problem / Solution -->
		<div class="mb-20 grid gap-8 md:grid-cols-2">
			<div class="rounded-2xl border border-red-500/20 bg-red-500/5 p-8">
				<h3 class="mb-4 text-lg font-black text-red-400">The Old Way</h3>
				<ul class="space-y-3">
					{#each ['Hire a videographer — $500–$5,000 per shoot', 'Hire a graphic designer — $50–$150/hr', 'License stock footage — $50–$500 per clip', 'Buy music licenses — $20–$200 per track', 'Wait weeks for revisions', 'Same content style as everyone else'] as item (item)}
						<li class="flex items-start gap-3 text-sm text-white/60">
							<span class="mt-0.5 text-red-400">✗</span>
							{item}
						</li>
					{/each}
				</ul>
			</div>
			<div class="rounded-2xl border border-info/20 bg-info/5 p-8">
				<h3 class="mb-4 text-lg font-black text-info">The Content Factory Way</h3>
				<ul class="space-y-3">
					{#each ['Generate cinematic video in seconds — free', 'Create unique brand images instantly — free', 'Custom AI music for every video — included', 'Original sound effects on demand — included', 'Iterate in real time, no waiting', 'Completely unique content every time'] as item (item)}
						<li class="flex items-start gap-3 text-sm text-white/60">
							<span class="mt-0.5 text-info">✓</span>
							{item}
						</li>
					{/each}
				</ul>
			</div>
		</div>

		<!-- Section Label -->
		<div class="mb-12 flex items-center gap-4">
			<div class="h-px flex-1 bg-white/10"></div>
			<span class="text-xs font-semibold tracking-widest text-white/40 uppercase"
				>Marketing Use Cases</span
			>
			<div class="h-px flex-1 bg-white/10"></div>
		</div>

		<!-- Use Cases Grid -->
		<div class="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
			{#each [{ id: 'social', icon: '📱', title: 'Social Media Content', body: "Generate a week's worth of on-brand posts, stories, and reels in one session. Consistent visual style, custom music, unique imagery — every post looks intentional.", items: ['Instagram Reels & Stories', 'TikTok videos', 'LinkedIn thought leadership images', 'Twitter/X visual content'] }, { id: 'ads', icon: '🎯', title: 'Paid Ad Creative', body: 'The biggest lever in paid advertising is creative. Generate multiple ad variants, test different visuals and hooks, iterate fast without burning budget on reshoots.', items: ['Facebook & Instagram ads', 'YouTube pre-roll video ads', 'Display ad imagery', 'Multiple variants for A/B testing'] }, { id: 'web', icon: '🌐', title: 'Website & Landing Pages', body: 'Hero images, background videos, product mockups, testimonial visuals — all the visual assets your website needs, generated to match your brand exactly.', items: ['Hero section videos & images', 'Feature illustration assets', 'Background textures & atmospheres', 'Product-in-context imagery'] }, { id: 'email', icon: '📧', title: 'Email Marketing', body: 'Visually rich emails perform better. Generate header images, product showcases, and campaign visuals that make your emails stand out in a crowded inbox.', items: ['Campaign header images', 'Product feature visuals', 'Promotional announcement graphics', 'Seasonal campaign imagery'] }, { id: 'video', icon: '🎬', title: 'Video Marketing', body: 'Full video marketing assets with custom music, 3D effects, and your branding baked in. Brand intros, product reveals, announcement videos — produced in minutes not weeks.', items: ['Brand intro videos', 'Product reveal clips', 'Timed text overlays with fade in/out', 'Video fade in & fade out', 'Event announcement videos', 'Testimonial backdrop videos'] }, { id: 'pitch', icon: '🤝', title: 'Pitch Decks & Presentations', body: 'Investor decks, client proposals, sales presentations — all need visuals. Generate on-brand imagery for every slide, making your pitch as visually compelling as your idea.', items: ['Investor pitch deck visuals', 'Client proposal imagery', 'Sales presentation assets', 'Conference & event graphics'] }] as useCase (useCase.id)}
				<div
					class="group rounded-2xl border border-white/10 bg-base-200 p-8 transition-all hover:border-info/30 hover:bg-base-300"
				>
					<div class="mb-5 text-4xl">{useCase.icon}</div>
					<h3 class="mb-3 text-lg font-bold text-white">{useCase.title}</h3>
					<p class="mb-4 text-sm leading-relaxed text-white/60">{useCase.body}</p>
					<ul class="space-y-1">
						{#each useCase.items as item (item)}
							<li class="text-xs text-white/40"><span class="text-info">→</span> {item}</li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>

		<!-- Workflow Section -->
		<div class="my-20 flex items-center gap-4">
			<div class="h-px flex-1 bg-white/10"></div>
			<span class="text-xs font-semibold tracking-widest text-white/40 uppercase"
				>The Marketing Workflow</span
			>
			<div class="h-px flex-1 bg-white/10"></div>
		</div>

		<div class="grid gap-4 md:grid-cols-5">
			{#each [{ step: '01', icon: '💡', label: 'Concept', desc: 'Write your prompt — describe the visual you need' }, { step: '02', icon: '🖼️', label: 'Generate', desc: 'AI produces your image or video in seconds' }, { step: '03', icon: '✨', label: 'Enhance', desc: 'Refine, add 3D effects, logo, particles, timed text, and audio' }, { step: '04', icon: '💾', label: 'Save', desc: 'Everything goes to your Content Library' }, { step: '05', icon: '🚀', label: 'Deploy', desc: 'Download and publish across all your channels' }] as item (item.step)}
				<div class="rounded-xl border border-white/10 bg-base-200 p-6 text-center">
					<div class="mb-3 text-3xl">{item.icon}</div>
					<div class="mb-1 text-xs font-bold text-info">{item.step}</div>
					<div class="mb-2 text-sm font-bold text-white">{item.label}</div>
					<div class="text-xs text-white/40">{item.desc}</div>
				</div>
			{/each}
		</div>

		<!-- Stats -->
		<div class="my-20 grid gap-6 md:grid-cols-4">
			{#each [{ stat: '10 min', label: 'Average time to produce a full social content set' }, { stat: '100%', label: 'Original content — no stock, no licensing issues' }, { stat: '8+', label: 'Output types — images, 3D videos, enhanced audio, voice over' }, { stat: '$0', label: 'Cost to generate on the free plan' }] as item (item.stat)}
				<div class="rounded-xl border border-info/20 bg-info/5 p-6 text-center">
					<div class="mb-2 text-3xl font-black text-info">{item.stat}</div>
					<div class="text-xs text-white/50">{item.label}</div>
				</div>
			{/each}
		</div>

		<!-- CTA -->
		<div class="rounded-2xl border border-info/20 bg-info/5 p-12 text-center">
			<h2 class="mb-4 text-3xl font-black text-white">
				Your Marketing Content Pipeline Starts Here.
			</h2>
			<p class="mb-8 text-white/50">Start free — no credit card, no agency, no waiting.</p>
			<div class="flex flex-col items-center justify-center gap-4 sm:flex-row">
				<a href="/create" class="btn btn-lg btn-info">🖼️ Generate Marketing Images</a>
				<a href="/create" class="btn text-white btn-outline btn-lg hover:btn-info"
					>🎬 Create Marketing Videos</a
				>
			</div>
		</div>
	</div>
</div>
