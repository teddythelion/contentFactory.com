<script lang="ts">
	import { authStore } from '$lib/stores/auth.store';

	// ── SHOWCASE GRID ────────────────────────────────────────────────
	// Drop clips in static/showcase/ and list them here — the section stays
	// hidden while this array is empty, so shipping without videos is safe.
	// Keep clips short (5–15s), muted-friendly, ~720p. Poster optional but
	// recommended (first-frame JPEG) so the grid paints before video loads.
	// `process` is the honest recipe line — what was actually done, in-app.
	interface ShowcaseClip {
		src: string;
		poster?: string;
		title: string;
		process: string;
	}
	const showcase: ShowcaseClip[] = [
		{ src: '/showcase/clip1.mp4', title: 'Example title 1', process: 'Process → outcome caption 1' },
		{ src: '/showcase/clip2.mp4', title: 'Example title 2', process: 'Process → outcome caption 2' },
		{ src: '/showcase/clip3.mp4', title: 'Example title 3', process: 'Process → outcome caption 3' },
		{ src: '/showcase/clip4.mp4', title: 'Example title 4', process: 'Process → outcome caption 4' },
		{ src: '/showcase/clip5.mp4', title: 'Example title 5', process: 'Process → outcome caption 5' },
		{ src: '/showcase/clip6.mp4', title: 'Example title 6', process: 'Process → outcome caption 6' }
	];

	// Play only while on screen — six autoplaying videos would hammer mobile
	function autoplayInView(node: HTMLVideoElement) {
		const io = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (e.isIntersecting) (e.target as HTMLVideoElement).play().catch(() => {});
					else (e.target as HTMLVideoElement).pause();
				}
			},
			{ threshold: 0.35 }
		);
		io.observe(node);
		return { destroy: () => io.disconnect() };
	}

	const features = [
		{
			icon: '🎲',
			colorText: 'text-secondary',
			colorBorder: 'border-secondary',
			colorBg: 'bg-secondary/10',
			title: '3D Reference Workflow',
			desc: 'Build a 3D scene in the enhancer, feed it as a reference frame to Veo — accurate 3D text and objects in video nearly every time. Canva, CapCut, and Photoshop cannot do this.'
		},
		{
			icon: '⚡',
			colorText: 'text-accent',
			colorBorder: 'border-accent',
			colorBg: 'bg-accent/10',
			title: 'One-Shot Pipeline',
			desc: 'Edit an image, enhance it in 3D, generate a video — all without leaving the app. No exports, no re-uploads, no tool switching.'
		},
		{
			icon: '🧠',
			colorText: 'text-primary',
			colorBorder: 'border-primary',
			colorBg: 'bg-primary/10',
			title: 'Built-In Prompt Engineer',
			desc: "Not a blank prompt box. The Prompt Engineer guides you to craft precise, effective prompts so your first generation is your best generation."
		},
		{
			icon: '🎬',
			colorText: 'text-warning',
			colorBorder: 'border-warning',
			colorBg: 'bg-warning/10',
			title: 'Frames-to-Video',
			desc: 'Set a beginning, middle, and end frame — Veo fills in the story. Stack with extended video for consistent 2-minute ads, shorts, and music videos.'
		},
		{
			icon: '🎞️',
			colorText: 'text-info',
			colorBorder: 'border-info',
			colorBg: 'bg-info/10',
			title: 'A Real Timeline, Not a Toy',
			desc: 'Multi-track editing with 21 transition styles, text and true 3D text, per-clip fades and transforms, undo/redo. What you see in the preview is exactly what bakes into the export.'
		},
		{
			icon: '🧰',
			colorText: 'text-success',
			colorBorder: 'border-success',
			colorBg: 'bg-success/10',
			title: 'Logo-to-Launch Brand Kits',
			desc: 'Run an entire campaign in one sitting: logo treatments, social covers, splash-page heroes, profile banners — then animate the same identity into a branded launch video. Everything matches.'
		}
	];

	const useCases = [
		{
			emoji: '🎵',
			title: 'DIY Music Videos',
			desc: 'Upload your track. Generate consistent visuals across 2 full minutes using frame references. No studio, no budget.'
		},
		{
			emoji: '🍽️',
			title: 'Restaurant Menu Makeover',
			desc: 'Snap a photo of any text-only menu. Get it back with AI-generated food imagery for every item — ready to print or post.'
		},
		{
			emoji: '📸',
			title: 'Bring Photos to Life',
			desc: 'Animate a still image of someone special into a short video. Memories, tributes, family moments — given new life.'
		},
		{
			emoji: '💪',
			title: 'Plate-to-Macros',
			desc: 'Photo your meal and get calorie and macro estimates instantly. No barcode scanning, no manual logging.'
		},
		{
			emoji: '🧰',
			title: 'Complete Brand Campaign',
			desc: 'Logo, social covers, splash-page heroes, and a branded launch video — one workflow, one afternoon, everything matching.'
		},
		{
			emoji: '🛍️',
			title: 'Product Ads That Look Expensive',
			desc: 'One product photo becomes a cinematic ad: premium video, your logo, 3D text, and a custom score. No shoot, no crew.'
		},
		{
			emoji: '🌐',
			title: 'Website Hero Sections',
			desc: 'Generate the hero image, then animate it into a looping 1080p background video. Your landing page just leveled up.'
		},
		{
			emoji: '📣',
			title: 'Event & Launch Promos',
			desc: 'Announcement videos with 3D text, particle atmosphere, and a custom score — done in an evening, not a week.'
		}
	];
</script>

<!-- Hero -->
<section class="relative flex min-h-[90vh] flex-col items-center justify-center overflow-hidden px-4 py-16 text-center">
	<!-- Hero background video — drop /static/showcase/hero.mp4; dark overlay keeps text readable -->
	<video
		src="/showcase/hero.mp4"
		muted
		loop
		autoplay
		playsinline
		preload="metadata"
		class="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40"
		style="object-position: 50% 20%;"
	></video>
	<div class="pointer-events-none absolute inset-0 bg-gradient-to-b from-base-100/70 via-base-100/55 to-base-100"></div>
	<div class="relative z-10 flex flex-col items-center">
	<h1 class="mb-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-7xl">
		Create videos
		<br />
		<span
			class="bg-gradient-to-r from-secondary via-primary to-accent bg-clip-text text-transparent"
		>
			nobody else can.
		</span>
	</h1>

	<p class="mb-8 max-w-xl text-base text-base-content/70 sm:text-lg">
		Generation is the easy part — the magic is everything after. Content Factory pairs AI video,
		image, music and voice generation with a real multi-track studio, so you shape every frame
		until it's exactly what you envisioned. One clip or a complete brand campaign — logo, social
		covers, hero images, launch video — one app, one sitting, idea to ship.
	</p>

	<div class="flex flex-col gap-3 sm:flex-row">
		<a href="/create" class="btn btn-secondary btn-lg w-full sm:w-auto">
			Start Creating
		</a>
		<a href="/prompt-coach" class="btn btn-outline btn-lg w-full sm:w-auto">
			Try Prompt Engineer 
		</a>
	</div>

	<p class="mt-6 text-xs text-base-content/40">
		No credit card required to try it &nbsp;·&nbsp; Real prices, no bait &nbsp;·&nbsp; <a href="/pricing" class="link link-hover text-base-content/60">View pricing</a>
	</p>
	</div>
</section>

<!-- Showcase — real output, honest recipes. Hidden until clips are added. -->
{#if showcase.length > 0}
	<section class="px-4 py-16">
		<!-- 14.5% side space / 33% video / 4% gap / 33% video / 14.5% (of content area) -->
		<div class="mx-auto w-full lg:px-[14.5%]">
			<h2 class="mb-2 text-center text-2xl font-bold sm:text-3xl">
				Made here, <span class="bg-gradient-to-r from-secondary to-accent bg-clip-text text-transparent">start to finish</span>
			</h2>
			<p class="mx-auto mb-10 max-w-2xl text-center text-sm text-base-content/60">
				Every clip below was generated, edited, scored and exported inside Content Factory —
				no other tools touched it. The caption under each one is the actual recipe.
			</p>
			<div class="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-[5.6%]">
				{#each showcase as clip (clip.src)}
					<figure class="group overflow-hidden rounded-2xl border border-white/10 bg-base-200 transition-transform duration-300 hover:-translate-y-1 hover:border-secondary/40">
						<div class="relative aspect-video overflow-hidden bg-black">
							<video
								src={clip.src}
								poster={clip.poster}
								muted
								loop
								playsinline
								preload="metadata"
								use:autoplayInView
								class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
							></video>
						</div>
						<figcaption class="p-4">
							<p class="mb-1 font-semibold">{clip.title}</p>
							<p class="text-xs leading-relaxed text-base-content/60">{clip.process}</p>
						</figcaption>
					</figure>
				{/each}
			</div>
		</div>
	</section>
{/if}

<!-- What sets it apart -->
<section class="px-4 py-16">
	<div class="mx-auto max-w-5xl">
		<h2 class="mb-2 text-center text-2xl font-bold sm:text-3xl">
			What other tools
			<span class="text-secondary">can't do</span>
		</h2>
		<p class="mb-10 text-center text-sm text-base-content/50">
			These aren't incremental improvements — they're workflows that don't exist anywhere else.
		</p>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			{#each features as f}
				<div
					class="card border {f.colorBorder} {f.colorBg} border-opacity-40 bg-base-200 shadow-md"
				>
					<div class="card-body gap-2 p-5">
						<div class="text-3xl">{f.icon}</div>
						<h3 class="card-title text-base {f.colorText} sm:text-lg">{f.title}</h3>
						<p class="text-sm text-base-content/70">{f.desc}</p>
					</div>
				</div>
			{/each}
		</div>
	</div>
</section>

<!-- Use cases -->
<section class="bg-base-200 px-4 py-16">
	<div class="mx-auto max-w-5xl">
		<h2 class="mb-2 text-center text-2xl font-bold sm:text-3xl">
			Use cases nobody
			<span class="text-accent">talks about</span>
		</h2>
		<p class="mb-10 text-center text-sm text-base-content/50">
			These capabilities exist on other platforms — but no one shows you how to use them like this.
		</p>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{#each useCases as u}
				<div class="card bg-base-100 shadow">
					<div class="card-body items-center gap-2 p-5 text-center">
						<div class="text-4xl">{u.emoji}</div>
						<h3 class="font-bold text-sm sm:text-base">{u.title}</h3>
						<p class="text-xs text-base-content/60">{u.desc}</p>
					</div>
				</div>
			{/each}
		</div>
	</div>
</section>

<!-- Comparison strip -->
<section class="px-4 py-12">
	<div class="mx-auto max-w-3xl">
		<h2 class="mb-8 text-center text-xl font-bold sm:text-2xl">
			vs. everything else
		</h2>
		<div class="overflow-x-auto rounded-xl border border-base-300">
			<table class="table table-zebra w-full text-sm">
				<thead>
					<tr>
						<th class="text-base-content/60">Capability</th>
						<th class="text-center text-secondary">Content Factory</th>
						<th class="text-center text-base-content/40">Canva / CapCut / Adobe</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>3D reference → video</td>
						<td class="text-center text-secondary font-bold">✓</td>
						<td class="text-center text-base-content/30">✗</td>
					</tr>
					<tr>
						<td>One-shot image→3D→video pipeline</td>
						<td class="text-center text-secondary font-bold">✓</td>
						<td class="text-center text-base-content/30">✗</td>
					</tr>
					<tr>
						<td>Built-in Prompt Engineer </td>
						<td class="text-center text-secondary font-bold">✓</td>
						<td class="text-center text-base-content/30">✗</td>
					</tr>
					<tr>
						<td>Frames-to-video consistency</td>
						<td class="text-center text-secondary font-bold">✓</td>
						<td class="text-center text-base-content/30">✗</td>
					</tr>
					<tr>
						<td>Multi-track timeline + 21 transitions</td>
						<td class="text-center text-secondary font-bold">✓</td>
						<td class="text-center text-base-content/30">separate app</td>
					</tr>
					<tr>
						<td>3D text &amp; particle systems over video</td>
						<td class="text-center text-secondary font-bold">✓</td>
						<td class="text-center text-base-content/30">✗</td>
					</tr>
					<tr>
						<td>Full brand kit — logo to launch video</td>
						<td class="text-center text-secondary font-bold">✓</td>
						<td class="text-center text-base-content/30">multiple tools</td>
					</tr>
					<tr>
						<td>Upload your own audio / music</td>
						<td class="text-center text-secondary font-bold">✓</td>
						<td class="text-center text-base-content/30">partial</td>
					</tr>
					<tr>
						<td>Ready-to-ship in minutes</td>
						<td class="text-center text-secondary font-bold">✓</td>
						<td class="text-center text-base-content/30">hours</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>
</section>

<!-- Final CTA -->
<section class="px-4 py-20 text-center">
	<h2 class="mb-3 text-3xl font-black sm:text-4xl">
		Ready to make something
		<span class="bg-gradient-to-r from-secondary to-accent bg-clip-text text-transparent">
			remarkable?
		</span>
	</h2>
	<p class="mb-8 text-base-content/60">
		Get started today. No credit card. No friction.
	</p>
	<a href="/create" class="btn btn-secondary btn-lg">
		{$authStore.user ? 'Go to Studio' : 'Create Your First Video'}
	</a>
</section>
