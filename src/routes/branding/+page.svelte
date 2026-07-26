<script lang="ts">
  // Branding Page — Content Factory
  // Svelte 5 runes mode — no $:, no on:event, keyed {#each}

  let activePlaybook = $state('visual-identity');
  let completedSteps = $state<Record<string, number[]>>({});

  function toggleStep(playbook: string, step: number) {
    const current = completedSteps[playbook] ?? [];
    if (current.includes(step)) {
      completedSteps = { ...completedSteps, [playbook]: current.filter(s => s !== step) };
    } else {
      completedSteps = { ...completedSteps, [playbook]: [...current, step] };
    }
  }

  function isStepDone(playbook: string, step: number) {
    return (completedSteps[playbook] ?? []).includes(step);
  }

  function getProgress(playbook: string, total: number) {
    return Math.round(((completedSteps[playbook]?.length ?? 0) / total) * 100);
  }

  const playbooks = [
    { id: 'visual-identity', emoji: '🎨', label: 'Visual Identity' },
    { id: 'social-content', emoji: '📱', label: 'Social Content' },
    { id: 'video-branding', emoji: '🎬', label: 'Video Branding' },
    { id: 'brand-consistency', emoji: '🔁', label: 'Brand Consistency' },
  ];

  const visualIdentitySteps = [
    {
      step: 1,
      phase: 'Image Generation',
      title: 'Generate Your Brand Hero Image',
      body: "Every brand needs a defining visual. Use the image generator to create a hero image that captures your brand's mood, industry, and personality. Think: what does your brand feel like?",
      example: '"A sleek, minimalist workspace for a modern creative agency, dark aesthetic, soft blue ambient lighting, ultra-realistic, 4K"',
      tip: null,
      cta: { label: '🖼️ Open Image Generator', href: '/create' }
    },
    {
      step: 2,
      phase: 'Refinement',
      title: "Refine Until It's Exactly Right",
      body: "Upload the image you generated into Image Edit and use Ultra Refinement to push the details further. Sharpen the mood, adjust the tone, refine the textures. This is your brand foundation — it needs to be perfect.",
      example: null,
      tip: null,
      cta: { label: '✏️ Open Image Edit', href: '/create' }
    },
    {
      step: 3,
      phase: 'Variation',
      title: 'Build a Visual Family',
      body: "Generate 4–6 variations of your hero image using the same core prompt with small tweaks. Vary the angle, composition, or lighting — and vary the format: 16:9 for website heroes and covers, 9:16 for stories, 1:1 for profile imagery. This gives you a visual family — a full campaign kit that feels cohesive without being identical.",
      example: null,
      tip: "Save every variation to your Content Library. You'll use these as social covers, splash-page heroes, profile banners, pitch decks, and more.",
      cta: { label: '🖼️ Generate Variations', href: '/create' }
    },
    {
      step: 4,
      phase: 'Archive',
      title: 'Save Your Brand Kit to Your Library',
      body: "Download your full set of brand images from the Content Library. You now have a complete brand campaign kit — hero image, social covers, profile banners, splash-page assets — all AI-generated, all yours, all consistent. Built in one sitting, not billed in agency weeks.",
      example: null,
      tip: null,
      cta: { label: '📚 Open Content Library', href: '/content-library' }
    }
  ];

  const socialContentSteps = [
    {
      step: 1,
      phase: 'Plan',
      title: 'Pick Your Content Pillars',
      body: 'Before generating anything, decide on 3 content themes (pillars) for the week. Examples: Product showcase, Behind the scenes, Inspiration/lifestyle. Each pillar gets its own visual style — this is what makes your feed look intentional.',
      example: null,
      tip: null,
      cta: null
    },
    {
      step: 2,
      phase: 'Generate',
      title: 'Batch Generate Your Images',
      body: "Use the Prompt Engineer to craft one strong prompt per pillar, then generate 2–3 variations of each. That's your week of content — 6 to 9 unique visuals, all on-brand, generated in under 10 minutes.",
      example: null,
      tip: 'Use 9:16 aspect ratio for Stories and Reels. Use 1:1 or 4:3 for feed posts.',
      cta: { label: '🖼️ Start Generating', href: '/create' }
    },
    {
      step: 3,
      phase: 'Video',
      title: 'Animate Your Best Image Into a Reel',
      body: "Take your strongest image from each pillar and drop it into Text to Video. Write an animation prompt and generate a 6–8 second clip. Reels and TikToks get 3–5x more reach than static posts — this is how you compete.",
      example: '"[Camera move] the scene, [describe motion], [mood/atmosphere], cinematic"',
      tip: null,
      cta: { label: '🎬 Open Video Generator', href: '/create' }
    },
    {
      step: 4,
      phase: 'Audio',
      title: 'Add a Signature Sound',
      body: "Open the 3D Enhancer on your video and go to the Audio tab. Go to the Music / Voice Over section and generate a short background track that matches your brand's energy — cinematic, lo-fi, upbeat, whatever fits. Set it to fade in and out cleanly. Bake it into the export. A consistent audio signature makes your content instantly recognizable.",
      example: null,
      tip: "Write down the music prompt that works for your brand. Reuse it every session to keep your sound consistent.",
      cta: { label: '🎵 Open Audio Studio', href: '/create' }
    },
    {
      step: 5,
      phase: 'Download & Post',
      title: 'Download Your Week of Content',
      body: "Head to your Content Library, download everything you generated this session, and load it into your scheduler. You're done. One session, one week of on-brand, high-quality content ready to post.",
      example: null,
      tip: null,
      cta: { label: '📚 Go to Library', href: '/content-library' }
    }
  ];

  const videoBrandingSteps = [
    {
      step: 1,
      phase: 'Generate',
      title: 'Generate Your Base Video',
      body: "Start with a strong text-to-video prompt. This is the raw footage your brand video will be built from. Aim for something atmospheric — motion, light, energy. It doesn't need to be perfect yet, it just needs to feel right.",
      tip: 'Use 16:9 for YouTube/desktop, 9:16 for Reels/TikTok. Pick your format before you generate.',
      cta: { label: '🎬 Open Video Generator', href: '/create' }
    },
    {
      step: 2,
      phase: '3D Enhance',
      title: 'Wrap It in 3D',
      body: 'Open the 3D Enhancer from the Tools dropdown on your video. Choose a shape that fits your brand — a spinning sphere for something cosmic and tech-forward, a plane for a clean editorial look, a torus for something bold and geometric.',
      tip: 'The sphere and plane are the most versatile for branding. Start with one of these.',
      cta: { label: '✨ Open 3D Enhancer', href: '/create' }
    },
    {
      step: 3,
      phase: 'Logo',
      title: 'Add Your Logo',
      body: "In the 3D Enhancer, upload your logo PNG and position it over the video. Use the XYZ controls to place it exactly where you want. Choose an animation — fade in, pulse, or rotate — so it feels dynamic, not pasted on.",
      tip: 'Use a white or transparent PNG logo for best results against dark video backgrounds.',
      cta: { label: '✨ Open 3D Enhancer', href: '/create' }
    },
    {
      step: 4,
      phase: 'Particles',
      title: 'Add Particles for Atmosphere',
      body: "Turn on the particle system and choose a style that matches your brand energy. Orbit particles feel premium and tech-forward. Fountain feels dynamic and energetic. Spiral feels elegant and creative. Want something nobody else has? Switch the render mode to 3D Shapes for lit, tumbling geometry with tracer trails, or Shape Cloud for a drifting constellation that holds a 3D form as it moves. Adjust size, opacity, and color to complement — not overpower — your video.",
      tip: 'Keep particle opacity between 0.3–0.6 for a subtle, premium look. Max opacity feels cheap.',
      cta: { label: '✨ Open 3D Enhancer', href: '/create' }
    },
    {
      step: 5,
      phase: 'Audio',
      title: 'Score It With Custom Audio',
      body: "Go to the Audio tab in the 3D Enhancer and generate a custom background track or add a voice over that fits your brand. Set a fade in at the start and fade out at the end. Adjust the volume so the audio lifts the video without overpowering it. This is what separates amateur content from professional.",
      tip: "For a 6–8 second brand video, generate 30 seconds of music and set the end time to match your video length.",
      cta: { label: '🎵 Open Audio Studio', href: '/create' }
    },
    {
      step: 6,
      phase: 'Export',
      title: 'Export Your Signature Video',
      body: "Hit Capture Video. The encoder runs in the background — your video, 3D effects, logo, particles, audio fades, and music or voice over all get baked together into a single MP4. Head to your Content Library to download it.",
      tip: 'Save this exact configuration — shape, particle style, logo position, music style. This becomes your branded video template.',
      cta: { label: '📚 Go to Content Library', href: '/content-library' }
    }
  ];

  const brandConsistencySteps = [
    {
      step: 1,
      phase: 'Prompt Template',
      title: 'Build Your Brand Prompt Template',
      body: "The single most powerful thing you can do for brand consistency is build a reusable prompt template. This is a base prompt with your brand's visual DNA baked in — lighting, mood, color palette, style. Every piece of content starts from this template.",
      example: '"[SUBJECT], [brand color] color palette, [your aesthetic] style, [your lighting], ultra-realistic, cinematic quality"',
      tip: 'Save your template somewhere accessible. Paste it into every generation session and just swap out [SUBJECT].',
      cta: null
    },
    {
      step: 2,
      phase: 'Style Lock',
      title: 'Lock In Your Visual Style',
      body: "Use the Image Edit ultra-refinement feature to establish your exact visual style on one anchor image. Save it to your library. This becomes your style reference — every new image you generate should feel like it belongs in the same family as this one.",
      example: null,
      tip: "When in doubt, compare new content to your style reference. If it doesn't match, refine it or regenerate.",
      cta: { label: '✏️ Open Image Edit', href: '/create' }
    },
    {
      step: 3,
      phase: 'Audio Identity',
      title: 'Establish Your Brand Sound',
      body: "Just like your visual style, your brand needs an audio signature. Generate a Music / Voice Over track that perfectly captures your brand energy and save it. Use this same style — same tempo, same mood, same genre — across every video you produce.",
      example: null,
      tip: 'Write down the exact music prompt that generated your signature track. Reuse it every session with minor tweaks to keep the sound consistent without being identical.',
      cta: { label: '🎵 Open Audio Studio', href: '/create' }
    },
    {
      step: 4,
      phase: 'Library Organization',
      title: 'Treat Your Library as a Brand Asset Vault',
      body: "Every piece of content you create lives in your Content Library. Use it intentionally — save only your best work, download full sets before posting, and revisit it before each new session to stay consistent with what you've already established.",
      example: null,
      tip: 'Before each content session, open the library and review your last 6–10 pieces. This puts your brand visual language back in your head before you start generating.',
      cta: { label: '📚 Open Library', href: '/content-library' }
    },
    {
      step: 5,
      phase: 'Branded Video Template',
      title: 'Create a Repeatable Video Format',
      body: "Once you've built your signature branded video (Playbook 03), document the exact settings: shape, particle style, rotation speed, glow settings, logo position, music style. Recreate this exact setup for every video you produce.",
      example: null,
      tip: 'Audiences recognize format before they recognize content. A consistent video style makes your brand instantly identifiable in a feed.',
      cta: { label: '🎬 Build Your Video Template', href: '/create' }
    }
  ];

  const socialPillars = [
    { id: 'product', label: 'Product / Service', example: '"Show my product in a luxury setting"' },
    { id: 'lifestyle', label: 'Lifestyle / Mood', example: '"The feeling of using my brand"' },
    { id: 'value', label: 'Value / Education', example: '"A visual that communicates a key stat"' }
  ];
</script>

<div class="min-h-screen bg-base-100">

  <!-- Hero -->
  <div class="relative overflow-hidden border-b border-white/5 bg-base-200 px-6 py-20 text-center">
    <div class="pointer-events-none absolute inset-0 opacity-5"
      style="background-image: linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px); background-size: 40px 40px;">
    </div>
    <div class="relative z-10 mx-auto max-w-3xl">
      <div class="mb-4 inline-block rounded-full border border-info/30 bg-info/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-info">
        Branding Playbooks
      </div>
      <h1 class="mb-6 text-4xl font-black leading-tight text-white md:text-6xl">
        Build a Brand That<br />
        <span class="text-info">Can't Be Ignored.</span>
      </h1>
      <p class="mx-auto max-w-2xl text-lg text-white/60">
        Four interactive playbooks showing you exactly how to use Content Factory
        to build a cohesive, scroll-stopping brand — step by step.
      </p>
    </div>
  </div>

  <div class="mx-auto max-w-6xl px-6 py-16">

    <!-- Playbook Tabs -->
    <div class="mb-10 flex flex-wrap gap-3">
      {#each playbooks as pb (pb.id)}
        <button
          onclick={() => activePlaybook = pb.id}
          class="flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold transition-all
            {activePlaybook === pb.id
              ? 'border-info bg-info/10 text-info'
              : 'border-white/10 bg-base-200 text-white/50 hover:border-white/20 hover:text-white'}"
        >
          <span>{pb.emoji}</span>
          <span>{pb.label}</span>
          {#if (completedSteps[pb.id]?.length ?? 0) > 0}
            <span class="rounded-full bg-info/20 px-2 py-0.5 text-xs text-info">
              {completedSteps[pb.id]?.length}✓
            </span>
          {/if}
        </button>
      {/each}
    </div>

    <!-- PLAYBOOK 1: Visual Identity -->
    {#if activePlaybook === 'visual-identity'}
    <div class="space-y-6">
      <div class="flex flex-col gap-4 rounded-2xl border border-white/10 bg-base-200 p-8 md:flex-row md:items-center md:justify-between">
        <div>
          <div class="mb-1 text-xs font-semibold uppercase tracking-widest text-info">Playbook 01</div>
          <h2 class="text-2xl font-black text-white">Visual Identity System</h2>
          <p class="mt-2 text-sm text-white/50">Create a consistent visual language across all your brand assets — starting from scratch with AI.</p>
        </div>
        <div class="flex flex-col items-end gap-2">
          <span class="text-2xl font-black text-white">{getProgress('visual-identity', visualIdentitySteps.length)}%</span>
          <div class="h-2 w-40 overflow-hidden rounded-full bg-base-300">
            <div class="h-full rounded-full bg-info transition-all" style="width: {getProgress('visual-identity', visualIdentitySteps.length)}%"></div>
          </div>
          <span class="text-xs text-white/30">{completedSteps['visual-identity']?.length ?? 0} of {visualIdentitySteps.length} steps done</span>
        </div>
      </div>

      {#each visualIdentitySteps as item (item.step)}
        <div class="rounded-2xl border {isStepDone('visual-identity', item.step) ? 'border-info/30 bg-info/5' : 'border-white/10 bg-base-200'} p-8 transition-all">
          <div class="flex flex-col gap-6 md:flex-row md:items-start">
            <div class="flex flex-shrink-0 flex-col items-center gap-3">
              <span class="text-4xl font-black {isStepDone('visual-identity', item.step) ? 'text-info' : 'text-white/10'}">0{item.step}</span>
              <button
                onclick={() => toggleStep('visual-identity', item.step)}
                class="flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all
                  {isStepDone('visual-identity', item.step) ? 'border-info bg-info text-white' : 'border-white/20 text-white/20 hover:border-info hover:text-info'}"
              >
                {isStepDone('visual-identity', item.step) ? '✓' : '○'}
              </button>
            </div>
            <div class="flex-1">
              <div class="mb-1 text-xs font-semibold uppercase tracking-widest text-info">Step {item.step} · {item.phase}</div>
              <h3 class="mb-3 text-xl font-bold text-white">{item.title}</h3>
              <p class="mb-4 text-sm leading-relaxed text-white/60">{item.body}</p>
              {#if item.example}
                <div class="mb-6 rounded-xl border border-white/10 bg-base-300 p-4">
                  <p class="mb-2 text-xs font-semibold uppercase tracking-widest text-white/40">Example Prompt</p>
                  <p class="font-mono text-sm text-info/80">{item.example}</p>
                </div>
              {/if}
              {#if item.tip}
                <div class="mb-6 rounded-xl border border-info/20 bg-info/5 px-4 py-3">
                  <p class="text-xs text-info/80">💡 {item.tip}</p>
                </div>
              {/if}
              {#if item.cta}
                <a href={item.cta.href} class="btn btn-info btn-sm">{item.cta.label} →</a>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
    {/if}

    <!-- PLAYBOOK 2: Social Content -->
    {#if activePlaybook === 'social-content'}
    <div class="space-y-6">
      <div class="flex flex-col gap-4 rounded-2xl border border-white/10 bg-base-200 p-8 md:flex-row md:items-center md:justify-between">
        <div>
          <div class="mb-1 text-xs font-semibold uppercase tracking-widest text-info">Playbook 02</div>
          <h2 class="text-2xl font-black text-white">Social Content Engine</h2>
          <p class="mt-2 text-sm text-white/50">Build a week's worth of scroll-stopping social content in one session.</p>
        </div>
        <div class="flex flex-col items-end gap-2">
          <span class="text-2xl font-black text-white">{getProgress('social-content', socialContentSteps.length)}%</span>
          <div class="h-2 w-40 overflow-hidden rounded-full bg-base-300">
            <div class="h-full rounded-full bg-info transition-all" style="width: {getProgress('social-content', socialContentSteps.length)}%"></div>
          </div>
          <span class="text-xs text-white/30">{completedSteps['social-content']?.length ?? 0} of {socialContentSteps.length} steps done</span>
        </div>
      </div>

      {#each socialContentSteps as item (item.step)}
        <div class="rounded-2xl border {isStepDone('social-content', item.step) ? 'border-info/30 bg-info/5' : 'border-white/10 bg-base-200'} p-8 transition-all">
          <div class="flex flex-col gap-6 md:flex-row md:items-start">
            <div class="flex flex-shrink-0 flex-col items-center gap-3">
              <span class="text-4xl font-black {isStepDone('social-content', item.step) ? 'text-info' : 'text-white/10'}">0{item.step}</span>
              <button
                onclick={() => toggleStep('social-content', item.step)}
                class="flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all
                  {isStepDone('social-content', item.step) ? 'border-info bg-info text-white' : 'border-white/20 text-white/20 hover:border-info hover:text-info'}"
              >
                {isStepDone('social-content', item.step) ? '✓' : '○'}
              </button>
            </div>
            <div class="flex-1">
              <div class="mb-1 text-xs font-semibold uppercase tracking-widest text-info">Step {item.step} · {item.phase}</div>
              <h3 class="mb-3 text-xl font-bold text-white">{item.title}</h3>
              <p class="mb-4 text-sm leading-relaxed text-white/60">{item.body}</p>
              {#if item.step === 1}
                <div class="mb-4 grid gap-3 md:grid-cols-3">
                  {#each socialPillars as pillar (pillar.id)}
                    <div class="rounded-xl border border-white/10 bg-base-300 p-4">
                      <p class="mb-1 text-xs font-bold text-white">{pillar.label}</p>
                      <p class="font-mono text-xs text-white/40">{pillar.example}</p>
                    </div>
                  {/each}
                </div>
              {/if}
              {#if item.example}
                <div class="mb-6 rounded-xl border border-white/10 bg-base-300 p-4">
                  <p class="mb-2 text-xs font-semibold uppercase tracking-widest text-white/40">Formula</p>
                  <p class="font-mono text-sm text-info/80">{item.example}</p>
                </div>
              {/if}
              {#if item.tip}
                <div class="mb-6 rounded-xl border border-info/20 bg-info/5 px-4 py-3">
                  <p class="text-xs text-info/80">💡 {item.tip}</p>
                </div>
              {/if}
              {#if item.cta}
                <a href={item.cta.href} class="btn btn-info btn-sm">{item.cta.label} →</a>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
    {/if}

    <!-- PLAYBOOK 3: Video Branding -->
    {#if activePlaybook === 'video-branding'}
    <div class="space-y-6">
      <div class="flex flex-col gap-4 rounded-2xl border border-white/10 bg-base-200 p-8 md:flex-row md:items-center md:justify-between">
        <div>
          <div class="mb-1 text-xs font-semibold uppercase tracking-widest text-info">Playbook 03</div>
          <h2 class="text-2xl font-black text-white">Signature Branded Video</h2>
          <p class="mt-2 text-sm text-white/50">Create a branded video with your logo, 3D effects, custom music, and a look nobody else has.</p>
        </div>
        <div class="flex flex-col items-end gap-2">
          <span class="text-2xl font-black text-white">{getProgress('video-branding', videoBrandingSteps.length)}%</span>
          <div class="h-2 w-40 overflow-hidden rounded-full bg-base-300">
            <div class="h-full rounded-full bg-info transition-all" style="width: {getProgress('video-branding', videoBrandingSteps.length)}%"></div>
          </div>
          <span class="text-xs text-white/30">{completedSteps['video-branding']?.length ?? 0} of {videoBrandingSteps.length} steps done</span>
        </div>
      </div>

      {#each videoBrandingSteps as item (item.step)}
        <div class="rounded-2xl border {isStepDone('video-branding', item.step) ? 'border-info/30 bg-info/5' : 'border-white/10 bg-base-200'} p-8 transition-all">
          <div class="flex flex-col gap-6 md:flex-row md:items-start">
            <div class="flex flex-shrink-0 flex-col items-center gap-3">
              <span class="text-4xl font-black {isStepDone('video-branding', item.step) ? 'text-info' : 'text-white/10'}">0{item.step}</span>
              <button
                onclick={() => toggleStep('video-branding', item.step)}
                class="flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all
                  {isStepDone('video-branding', item.step) ? 'border-info bg-info text-white' : 'border-white/20 text-white/20 hover:border-info hover:text-info'}"
              >
                {isStepDone('video-branding', item.step) ? '✓' : '○'}
              </button>
            </div>
            <div class="flex-1">
              <div class="mb-1 text-xs font-semibold uppercase tracking-widest text-info">Step {item.step} · {item.phase}</div>
              <h3 class="mb-3 text-xl font-bold text-white">{item.title}</h3>
              <p class="mb-4 text-sm leading-relaxed text-white/60">{item.body}</p>
              <div class="mb-6 rounded-xl border border-info/20 bg-info/5 px-4 py-3">
                <p class="text-xs text-info/80">💡 {item.tip}</p>
              </div>
              <a href={item.cta.href} class="btn btn-info btn-sm">{item.cta.label} →</a>
            </div>
          </div>
        </div>
      {/each}
    </div>
    {/if}

    <!-- PLAYBOOK 4: Brand Consistency -->
    {#if activePlaybook === 'brand-consistency'}
    <div class="space-y-6">
      <div class="flex flex-col gap-4 rounded-2xl border border-white/10 bg-base-200 p-8 md:flex-row md:items-center md:justify-between">
        <div>
          <div class="mb-1 text-xs font-semibold uppercase tracking-widest text-info">Playbook 04</div>
          <h2 class="text-2xl font-black text-white">Brand Consistency System</h2>
          <p class="mt-2 text-sm text-white/50">Build repeatable processes so every piece of content looks and sounds like it came from the same brand.</p>
        </div>
        <div class="flex flex-col items-end gap-2">
          <span class="text-2xl font-black text-white">{getProgress('brand-consistency', brandConsistencySteps.length)}%</span>
          <div class="h-2 w-40 overflow-hidden rounded-full bg-base-300">
            <div class="h-full rounded-full bg-info transition-all" style="width: {getProgress('brand-consistency', brandConsistencySteps.length)}%"></div>
          </div>
          <span class="text-xs text-white/30">{completedSteps['brand-consistency']?.length ?? 0} of {brandConsistencySteps.length} steps done</span>
        </div>
      </div>

      {#each brandConsistencySteps as item (item.step)}
        <div class="rounded-2xl border {isStepDone('brand-consistency', item.step) ? 'border-info/30 bg-info/5' : 'border-white/10 bg-base-200'} p-8 transition-all">
          <div class="flex flex-col gap-6 md:flex-row md:items-start">
            <div class="flex flex-shrink-0 flex-col items-center gap-3">
              <span class="text-4xl font-black {isStepDone('brand-consistency', item.step) ? 'text-info' : 'text-white/10'}">0{item.step}</span>
              <button
                onclick={() => toggleStep('brand-consistency', item.step)}
                class="flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all
                  {isStepDone('brand-consistency', item.step) ? 'border-info bg-info text-white' : 'border-white/20 text-white/20 hover:border-info hover:text-info'}"
              >
                {isStepDone('brand-consistency', item.step) ? '✓' : '○'}
              </button>
            </div>
            <div class="flex-1">
              <div class="mb-1 text-xs font-semibold uppercase tracking-widest text-info">Step {item.step} · {item.phase}</div>
              <h3 class="mb-3 text-xl font-bold text-white">{item.title}</h3>
              <p class="mb-4 text-sm leading-relaxed text-white/60">{item.body}</p>
              {#if item.example}
                <div class="mb-4 rounded-xl border border-white/10 bg-base-300 p-4">
                  <p class="mb-2 text-xs font-semibold uppercase tracking-widest text-white/40">Template Formula</p>
                  <p class="font-mono text-sm text-info/80">{item.example}</p>
                </div>
              {/if}
              <div class="mb-6 rounded-xl border border-info/20 bg-info/5 px-4 py-3">
                <p class="text-xs text-info/80">💡 {item.tip}</p>
              </div>
              {#if item.cta}
                <a href={item.cta.href} class="btn btn-info btn-sm">{item.cta.label} →</a>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
    {/if}

    <!-- Bottom CTA -->
    <div class="mt-20 rounded-2xl border border-info/20 bg-info/5 p-12 text-center">
      <h2 class="mb-4 text-3xl font-black text-white">Your Brand Starts Now.</h2>
      <p class="mb-8 text-white/50">Pick a playbook above and work through it. Most take under 30 minutes.</p>
      <div class="flex flex-col items-center justify-center gap-4 sm:flex-row">
        <a href="/create" class="btn btn-info btn-lg">🖼️ Start with an Image</a>
        <a href="/create" class="btn btn-outline btn-lg text-white hover:btn-info">🎬 Start with a Video</a>
      </div>
    </div>

  </div>
</div>
