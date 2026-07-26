<script lang="ts">
  // Services page — Content Factory
</script>

<!-- Hero Section -->
<div class="min-h-screen bg-base-100">

  <!-- Hero -->
  <div class="relative overflow-hidden border-b border-white/5 bg-base-200 px-6 py-20 text-center">
    <div class="pointer-events-none absolute inset-0 opacity-5"
      style="background-image: linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px); background-size: 40px 40px;">
    </div>
    <div class="relative z-10 mx-auto max-w-3xl">
      <div class="mb-4 inline-block rounded-full border border-info/30 bg-info/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-info">
        What We Do
      </div>
      <h1 class="mb-6 text-4xl font-black leading-tight text-white md:text-6xl">
        Stop the Scroll.<br />
        <span class="text-info">Start the Story.</span>
      </h1>
      <p class="mx-auto max-w-2xl text-lg text-white/60">
        Content Factory gives creators, entrepreneurs, and brands a full AI-powered studio —
        right in the browser. From a single scroll-stopping clip to a complete brand campaign —
        logo, covers, hero images, launch video — generated, edited, and shipped in one sitting.
      </p>
    </div>
  </div>

  <!-- Services Grid -->
  <div class="mx-auto max-w-7xl px-6 py-20">

    <!-- Section Label -->
    <div class="mb-12 flex items-center gap-4">
      <div class="h-px flex-1 bg-white/10"></div>
      <span class="text-xs font-semibold uppercase tracking-widest text-white/40">Core Services</span>
      <div class="h-px flex-1 bg-white/10"></div>
    </div>

    <!-- Two Column Services -->
    <div class="grid gap-8 md:grid-cols-2">

      <!-- Service 1: AI Video Generation -->
      <div class="group rounded-2xl border border-white/10 bg-base-200 p-8 transition-all hover:border-info/30 hover:bg-base-300">
        <div class="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-info/10 text-3xl">
          🎬
        </div>
        <h3 class="mb-3 text-xl font-bold text-white">AI Video Generation</h3>
        <p class="mb-6 text-sm leading-relaxed text-white/60">
          Turn a text prompt or image into a stunning short-form video in seconds. 
          Powered by Google Veo — the same technology behind Hollywood-grade AI video. 
          Choose your duration, aspect ratio, and let the AI do the heavy lifting.
        </p>
        <ul class="space-y-2">
          {#each ['Text-to-video generation', 'Image-to-video animation', '4, 6, and 8 second clips', '16:9, 9:16, and 4:3 formats'] as feature}
            <li class="flex items-center gap-2 text-sm text-white/50">
              <span class="text-info">✓</span> {feature}
            </li>
          {/each}
        </ul>
      </div>

      <!-- Service 2: 3D Video Enhancement -->
      <div class="group rounded-2xl border border-white/10 bg-base-200 p-8 transition-all hover:border-info/30 hover:bg-base-300">
        <div class="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-info/10 text-3xl">
          ✨
        </div>
        <h3 class="mb-3 text-xl font-bold text-white">3D Studio &amp; Timeline Editor</h3>
        <p class="mb-6 text-sm leading-relaxed text-white/60">
          Not a filter menu — a real editor. Cut clips from any source on a multi-track timeline
          with 21 transition styles, layer in text and true 3D text, animate your logo, and fire
          off three distinct particle systems — including 3D shape particles that streak tracer
          trails across your footage. Everything previews live and bakes into a crisp 1080p MP4
          exactly as you saw it.
        </p>
        <ul class="space-y-2">
          {#each ['Multi-track timeline with 21 transitions', '14+ 3D shape options', '3D shape particles with tracer trails', 'Text overlays & true 3D text', 'Logo & image overlays with animation', 'Per-clip fades, transforms & undo/redo', 'Full audio mixing studio', 'Locked 1080p MP4 export'] as feature}
            <li class="flex items-center gap-2 text-sm text-white/50">
              <span class="text-info">✓</span> {feature}
            </li>
          {/each}
        </ul>
      </div>

      <!-- Service 3: AI Image Generation -->
      <div class="group rounded-2xl border border-white/10 bg-base-200 p-8 transition-all hover:border-info/30 hover:bg-base-300">
        <div class="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-info/10 text-3xl">
          🖼️
        </div>
        <h3 class="mb-3 text-xl font-bold text-white">Intentional Image Generation</h3>
        <p class="mb-6 text-sm leading-relaxed text-white/60">
          Why Your Videos Never Look Exactly Right.

Text prompts are guesses. You describe what you see in your head, the model interprets it, and what comes back is close — but not quite. The lighting's off. The mood isn't there. The subject doesn't feel right. So you generate again. And again.

The problem isn't the model. It's the medium. Text is an approximation of a visual idea. And approximations produce approximate results.

A picture is worth a thousand words — and a thousand tokens.


        </p>
        <ul class="space-y-2">
          {#each ['Photorealistic output', 'Multiple style options', 'High resolution export', 'Prompt engineering assistant'] as feature}
            <li class="flex items-center gap-2 text-sm text-white/50">
              <span class="text-info">✓</span> {feature}
            </li>
          {/each}
        </ul>
      </div>

      <!-- Service 4: Image Editing & Refinement -->
      <div class="group rounded-2xl border border-white/10 bg-base-200 p-8 transition-all hover:border-info/30 hover:bg-base-300">
        <div class="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-info/10 text-3xl">
          🎨
        </div>
        <h3 class="mb-3 text-xl font-bold text-white">Image Editing & Refinement</h3>
        <p class="mb-6 text-sm leading-relaxed text-white/60">
          At Content Factory, we flipped the workflow. Instead of describing your vision, you build it. Use our image tools to craft reference images — the exact atmosphere, subject, composition, and mood you want. Refine them until they're right. Images are fast and cheap to iterate. Video is not.

      When your reference image captures exactly what you're after, then you generate the video. The model now has a precise visual anchor — not a paragraph of adjectives, but an actual image of your intent. The result is a video that looks like your idea, not a model's interpretation of it.

      Closer on the first generation. Less waste. More control.

      That's the edge. Not just AI video — AI video guided by imagery you engineered. Reference images are the difference between a video that's almost right and one that's exactly right.
        </p>
        <ul class="space-y-2">
          {#each ['Upload & edit any image', 'AI ultra refinement', 'Identity-preserving face lock', 'Multi-reference compositing'] as feature}
            <li class="flex items-center gap-2 text-sm text-white/50">
              <span class="text-info">✓</span> {feature}
            </li>
          {/each}
        </ul>
      </div>

      <!-- Service 5: AI Sound Effects -->
      <div class="group rounded-2xl border border-white/10 bg-base-200 p-8 transition-all hover:border-info/30 hover:bg-base-300">
        <div class="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-info/10 text-3xl">
          🔊
        </div>
        <h3 class="mb-3 text-xl font-bold text-white">AI Sound Effects</h3>
        <p class="mb-6 text-sm leading-relaxed text-white/60">
          Generate custom sound effects from a text prompt and bake them directly 
          into your video export. Set start time, end time, fade in, fade out, 
          and loop — all in the live preview before you capture.
        </p>
        <ul class="space-y-2">
          {#each ['Prompt-based SFX generation', 'Live preview with real-time controls', 'Fade in & fade out', 'Loop mode with trim window', 'Baked into final video export'] as feature}
            <li class="flex items-center gap-2 text-sm text-white/50">
              <span class="text-info">✓</span> {feature}
            </li>
          {/each}
        </ul>
      </div>

      <!-- Service 6: AI Audio & Voice Over -->
      <div class="group rounded-2xl border border-white/10 bg-base-200 p-8 transition-all hover:border-info/30 hover:bg-base-300">
        <div class="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-info/10 text-3xl">
          🎵
        </div>
        <h3 class="mb-3 text-xl font-bold text-white">AI Audio & Voice Over</h3>
        <p class="mb-6 text-sm leading-relaxed text-white/60">
          Generate original background music or a voice over narration from a text prompt.
          Control duration up to 5 minutes, set start and end placement, and add fades.
          Audio gets mixed into your final video alongside SFX and original audio.
        </p>
        <ul class="space-y-2">
          {#each ['Prompt-based music generation', 'Voice over & narration support', 'Up to 5 minutes of audio', 'Start & end time placement', 'Fade in & fade out controls', 'Mixed into final video export'] as feature}
            <li class="flex items-center gap-2 text-sm text-white/50">
              <span class="text-info">✓</span> {feature}
            </li>
          {/each}
        </ul>
      </div>

      <!-- Service 7: Complete Brand Campaigns — full-width banner card -->
      <div class="group rounded-2xl border border-info/30 bg-gradient-to-br from-info/10 to-base-200 p-8 transition-all hover:border-info/50 md:col-span-2">
        <div class="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-info/10 text-3xl">
          🧰
        </div>
        <h3 class="mb-3 text-xl font-bold text-white">Complete Brand Campaigns — Logo to Launch</h3>
        <p class="mb-6 max-w-3xl text-sm leading-relaxed text-white/60">
          This is the workflow the whole studio exists for. Generate a logo treatment, spin it into
          matching social covers, profile banners, and splash-page hero images — then animate that
          same identity into a branded launch video with your logo, colors, particles, and a custom
          score baked in. One session. Every asset matching. Ready to post everywhere your brand lives.
          What an agency quotes in weeks, you ship before lunch.
        </p>
        <ul class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {#each ['Logo treatments & variations', 'Social covers & profile banners', 'Splash-page & website hero images', 'Matching branded launch video', 'Custom score & audio identity', 'One consistent identity across every asset'] as feature}
            <li class="flex items-center gap-2 text-sm text-white/50">
              <span class="text-info">✓</span> {feature}
            </li>
          {/each}
        </ul>
      </div>

    </div>

    <!-- Divider -->
    <div class="my-20 flex items-center gap-4">
      <div class="h-px flex-1 bg-white/10"></div>
      <span class="text-xs font-semibold uppercase tracking-widest text-white/40">Platform Features</span>
      <div class="h-px flex-1 bg-white/10"></div>
    </div>

    <!-- Platform Features — 3 column -->
    <div class="grid gap-6 md:grid-cols-3">

      <div class="rounded-xl border border-white/10 bg-base-200 p-6">
        <div class="mb-4 text-2xl">📚</div>
        <h4 class="mb-2 font-bold text-white">Content Library</h4>
        <p class="text-sm text-white/50">Every image and video you create is saved to your personal library. Download, reuse, or delete anytime.</p>
      </div>

      <div class="rounded-xl border border-white/10 bg-base-200 p-6">
        <div class="mb-4 text-2xl">🤖</div>
        <h4 class="mb-2 font-bold text-white">Prompt Engineer</h4>
        <p class="text-sm text-white/50">Not sure what to write? Our built-in prompt engineer helps you craft the perfect generation prompt every time.</p>
      </div>

      <div class="rounded-xl border border-white/10 bg-base-200 p-6">
        <div class="mb-4 text-2xl">⚡</div>
        <h4 class="mb-2 font-bold text-white">Background Processing</h4>
        <p class="text-sm text-white/50">Long renders process in the background. Navigate freely — your content downloads automatically when ready.</p>
      </div>

      <div class="rounded-xl border border-white/10 bg-base-200 p-6">
        <div class="mb-4 text-2xl">🎛️</div>
        <h4 class="mb-2 font-bold text-white">Audio Studio</h4>
        <p class="text-sm text-white/50">Full audio mixing inside the 3D enhancer — original audio, SFX, and music/voice over each controlled independently with volume, fade in/out, and live preview.</p>
      </div>

      <div class="rounded-xl border border-white/10 bg-base-200 p-6">
        <div class="mb-4 text-2xl">📱</div>
        <h4 class="mb-2 font-bold text-white">Mobile Friendly</h4>
        <p class="text-sm text-white/50">Full creative studio on any device. The 3D enhancer and all tools are optimized for mobile with touch-friendly controls.</p>
      </div>

      <div class="rounded-xl border border-white/10 bg-base-200 p-6">
        <div class="mb-4 text-2xl">🔒</div>
        <h4 class="mb-2 font-bold text-white">Secure & Private</h4>
        <p class="text-sm text-white/50">Your content is yours. Stored securely in your personal library with Google authentication and encrypted storage.</p>
      </div>

    </div>

    <!-- What's Coming Divider -->
    <div class="my-20 flex items-center gap-4">
      <div class="h-px flex-1 bg-white/10"></div>
      <span class="text-xs font-semibold uppercase tracking-widest text-white/40">What's Coming</span>
      <div class="h-px flex-1 bg-white/10"></div>
    </div>

    <!-- Roadmap Grid -->
    <div class="grid gap-6 md:grid-cols-3">

      <div class="rounded-xl border border-white/10 bg-base-200 p-6">
        <div class="mb-4 text-2xl">🧬</div>
        <h4 class="mb-2 font-bold text-white">Custom Shape Particles</h4>
        <p class="text-sm text-white/50">Particle clouds that assemble into real 3D models — your logo, your product, your mascot — then morph and trail across your video.</p>
      </div>

      <div class="rounded-xl border border-white/10 bg-base-200 p-6">
        <div class="mb-4 text-2xl">📐</div>
        <h4 class="mb-2 font-bold text-white">Custom Export Ratios</h4>
        <p class="text-sm text-white/50">Choose your output aspect ratio — 16:9, 9:16, 1:1, and more — at export time, not just at generation.</p>
      </div>

      <div class="rounded-xl border border-white/10 bg-base-200 p-6">
        <div class="mb-4 text-2xl">🎙️</div>
        <h4 class="mb-2 font-bold text-white">Voice Cloning</h4>
        <p class="text-sm text-white/50">Record or upload your voice and use it as a voice over across any video — same voice, every time.</p>
      </div>

      <div class="rounded-xl border border-white/10 bg-base-200 p-6">
        <div class="mb-4 text-2xl">💾</div>
        <h4 class="mb-2 font-bold text-white">Branded Video Presets</h4>
        <p class="text-sm text-white/50">Save your signature setup — shape, particles, logo position, score style — and reapply it to any new video in one click.</p>
      </div>

      <div class="rounded-xl border border-white/10 bg-base-200 p-6">
        <div class="mb-4 text-2xl">🌐</div>
        <h4 class="mb-2 font-bold text-white">Direct Publishing</h4>
        <p class="text-sm text-white/50">Publish straight to Instagram, TikTok, and YouTube from your Content Library — no downloading required.</p>
      </div>

      <div class="rounded-xl border border-white/10 bg-base-200 p-6">
        <div class="mb-4 text-2xl">👥</div>
        <h4 class="mb-2 font-bold text-white">Team Workspaces</h4>
        <p class="text-sm text-white/50">Shared brand libraries, prompt templates, and content approval flows for teams and agencies.</p>
      </div>

    </div>

    <!-- CTA -->
    <div class="mt-20 rounded-2xl border border-info/20 bg-info/5 p-12 text-center">
      <h2 class="mb-4 text-3xl font-black text-white">Ready to Create?</h2>
      <p class="mb-8 text-white/50">Start creating today — no credit card required.</p>
      <div class="flex flex-col items-center justify-center gap-4 sm:flex-row">
        <a href="/create" class="btn btn-info btn-lg">
          🖼️ Generate an Image
        </a>
        <a href="/create" class="btn btn-outline btn-lg text-white hover:btn-info">
          🎬 Generate a Video
        </a>
      </div>
    </div>

  </div>
</div>
