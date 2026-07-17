<script lang="ts">
	import { authStore } from '$lib/stores/auth.store';

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
		}
	];
</script>

<!-- Hero -->
<section class="flex min-h-[90vh] flex-col items-center justify-center px-4 py-16 text-center">
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
		Content Factory combines 3D image enhancement, AI video generation, and a built-in Prompt Engineer 
		into one frictionless pipeline. From idea to ready-to-ship content in minutes.
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
		No credit card required to try it
	</p>
</section>

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
