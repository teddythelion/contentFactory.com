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
        right in the browser. Generate, enhance, and distribute content that actually gets noticed.
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
        <h3 class="mb-3 text-xl font-bold text-white">3D Video Enhancement</h3>
        <p class="mb-6 text-sm leading-relaxed text-white/60">
          Wrap your video onto 3D geometry — spheres, cubes, planes, and more. 
          Add particle systems, glow effects, animated text, and your logo. 
          Export a fully rendered MP4 ready for posting anywhere.
        </p>
        <ul class="space-y-2">
          {#each ['14+ 3D shape options', 'Custom particle systems', 'Logo & text overlay', 'Glow & lighting effects'] as feature}
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
        <h3 class="mb-3 text-xl font-bold text-white">AI Image Generation</h3>
        <p class="mb-6 text-sm leading-relaxed text-white/60">
          Generate production-ready images from a single prompt. 
          From product mockups to brand visuals to social content — 
          get scroll-stopping imagery without a photographer or designer.
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
          Upload any image and refine it with AI-powered editing. 
          Adjust, enhance, and transform existing visuals without 
          touching Photoshop. Ultra-refinement mode takes your image further than ever.
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

      <!-- Service 6: AI Music Generation -->
      <div class="group rounded-2xl border border-white/10 bg-base-200 p-8 transition-all hover:border-info/30 hover:bg-base-300">
        <div class="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-info/10 text-3xl">
          🎵
        </div>
        <h3 class="mb-3 text-xl font-bold text-white">AI Music Generation</h3>
        <p class="mb-6 text-sm leading-relaxed text-white/60">
          Generate original background music from a text prompt — from cinematic 
          orchestral scores to lo-fi beats to high-energy tracks. Control duration 
          up to 5 minutes, placement, and fades. Music gets mixed into your final video.
        </p>
        <ul class="space-y-2">
          {#each ['Prompt-based music generation', 'Up to 5 minutes of original music', 'Start & end time placement', 'Fade in & fade out controls', 'Mixed into final video export'] as feature}
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
        <p class="text-sm text-white/50">Not sure what to write? Our built-in prompt coach helps you craft the perfect generation prompt every time.</p>
      </div>

      <div class="rounded-xl border border-white/10 bg-base-200 p-6">
        <div class="mb-4 text-2xl">⚡</div>
        <h4 class="mb-2 font-bold text-white">Background Processing</h4>
        <p class="text-sm text-white/50">Long renders process in the background. Navigate freely — your content downloads automatically when ready.</p>
      </div>

      <div class="rounded-xl border border-white/10 bg-base-200 p-6">
        <div class="mb-4 text-2xl">🎛️</div>
        <h4 class="mb-2 font-bold text-white">Audio Studio</h4>
        <p class="text-sm text-white/50">Full audio mixing inside the 3D enhancer — control original audio, SFX, and music volume independently with live preview.</p>
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

    <!-- CTA -->
    <div class="mt-20 rounded-2xl border border-info/20 bg-info/5 p-12 text-center">
      <h2 class="mb-4 text-3xl font-black text-white">Ready to Create?</h2>
      <p class="mb-8 text-white/50">Start free — 2 images and 2 videos every day, no credit card required.</p>
      <div class="flex flex-col items-center justify-center gap-4 sm:flex-row">
        <a href="/texttoimage" class="btn btn-info btn-lg">
          🖼️ Generate an Image
        </a>
        <a href="/texttovideo" class="btn btn-outline btn-lg text-white hover:btn-info">
          🎬 Generate a Video
        </a>
      </div>
    </div>

  </div>
</div>
