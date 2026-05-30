<script lang="ts">
  // Advertising Page — Content Factory
  // Svelte 5 runes mode — no $:, no on:event, keyed {#each}

  let activeTab = $state('social');

  const tabs = [
    { id: 'social', label: '📱 Social Ads' },
    { id: 'video', label: '🎬 Video Ads' },
    { id: 'display', label: '🖥️ Display Ads' },
    { id: 'email', label: '📧 Email Campaigns' },
  ];

  const socialPrompts = [
    { label: 'Product Hero Shot', prompt: '"[Product] on a clean minimal surface, dramatic side lighting, luxury product photography, dark background, ultra-sharp focus"' },
    { label: 'Lifestyle Context', prompt: '"A [target customer] using [product] in [aspirational setting], candid and authentic, warm natural light, lifestyle photography"' },
    { label: 'Before/After Visual', prompt: '"Split composition showing transformation, left side [problem], right side [solution], clean infographic style, brand colors"' },
    { label: 'Urgency/Offer', prompt: '"Bold graphic with [offer] as the hero, energetic composition, high contrast, modern typography style, action-oriented visual"' }
  ];

  const videoSteps = [
    { icon: '🎬', title: 'Generate Base Video', desc: 'Text-to-video or image-to-video — create the raw footage for your ad in seconds. Choose duration and aspect ratio.' },
    { icon: '✨', title: 'Add 3D & Branding', desc: 'Open the 3D Enhancer. Add your logo, particle effects, and 3D geometry. This is what makes your ad look like a production budget was spent on it.' },
    { icon: '🎵', title: 'Score With Music', desc: 'Generate custom background music that fits your ad energy. Add sound effects for impact. Set fades. Export a fully produced video ad.' }
  ];

  const videoFormats = [
    'YouTube pre-roll (6–8 seconds, 16:9)',
    'Instagram Reel ads (6–8 seconds, 9:16)',
    'TikTok ads (6–8 seconds, 9:16)',
    'Facebook video ads (6–8 seconds, multiple ratios)',
    'Story ads (6 seconds, 9:16)',
    'Brand awareness loops (seamlessly repeating)'
  ];

  const displayAssets = [
    { label: 'Hero Images', desc: 'Striking visuals for large display formats — leaderboard, half-page, billboard.' },
    { label: 'Product Shots', desc: 'Clean, professional product-in-context imagery for retargeting ads.' },
    { label: 'Background Textures', desc: 'Brand-consistent backgrounds and atmospheric visuals for display ad templates.' },
    { label: 'Concept Visuals', desc: 'Abstract, conceptual imagery that communicates your value proposition visually.' }
  ];

  const emailAssets = [
    { label: 'Campaign Header Images', desc: "The first visual in your email sets the tone. Generate a striking header image that immediately communicates your campaign's offer and mood." },
    { label: 'Product Feature Visuals', desc: 'Show your product in aspirational contexts — not just a white background. Context sells. Generate lifestyle and in-use imagery that makes readers want what you\'re offering.' },
    { label: 'Promotional Graphics', desc: 'Sale announcements, limited time offers, new product launches — generate urgency-driven visuals that make your promotion impossible to ignore.' },
    { label: 'Seasonal Campaign Imagery', desc: 'Generate fresh imagery for every season and holiday campaign without reshooting. Black Friday, summer, new year — a new visual for every campaign.' }
  ];

  const emailTips = [
    'Use 600px wide images — standard email width',
    'Generate in 16:9 for header images',
    'Keep brand colors consistent across all visuals',
    'Use alt text — generate clean, descriptive images',
    'Test light and dark versions for different clients'
  ];

  const emailWorkflow = [
    { step: '01', action: 'Generate header image for campaign theme' },
    { step: '02', action: 'Refine in Image Edit for perfect quality' },
    { step: '03', action: 'Generate 2–3 product context visuals' },
    { step: '04', action: 'Save all assets to Content Library' },
    { step: '05', action: 'Download and drop into your email builder' }
  ];

  const stats = [
    { stat: '70%', label: 'of ad performance driven by creative quality' },
    { stat: '5x', label: 'more content needed to stay competitive vs 3 years ago' },
    { stat: '$0', label: 'cost per creative variation with Content Factory' }
  ];

  const socialAdvantages = [
    'Generate 5 headline visual variants in minutes',
    'Test different color palettes instantly',
    'Try multiple product angles and contexts',
    'Iterate based on performance data same-day',
    'Never run the same creative twice'
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
        Advertising
      </div>
      <h1 class="mb-6 text-4xl font-black leading-tight text-white md:text-6xl">
        Ad Creative That<br />
        <span class="text-info">Actually Converts.</span>
      </h1>
      <p class="mx-auto max-w-2xl text-lg text-white/60">
        The #1 variable in ad performance is creative. Content Factory lets you
        generate, test, and iterate ad creative at a speed no agency can match —
        and at a fraction of the cost.
      </p>
    </div>
  </div>

  <div class="mx-auto max-w-7xl px-6 py-20">

    <!-- The Creative Problem -->
    <div class="mb-20 rounded-2xl border border-white/10 bg-base-200 p-10">
      <div class="mx-auto max-w-3xl text-center">
        <h2 class="mb-6 text-2xl font-black text-white">Ad Creative is Your Biggest Lever</h2>
        <p class="mb-8 text-sm leading-relaxed text-white/60">
          Studies consistently show that creative quality accounts for
          <span class="font-semibold text-white">70–80% of ad performance</span>.
          You can have perfect targeting, perfect copy, and a perfect offer —
          but bad creative kills conversions. The brands winning at advertising
          are the ones producing the most creative, testing the fastest, and iterating constantly.
        </p>
        <div class="grid gap-6 md:grid-cols-3">
          {#each stats as item (item.stat)}
            <div class="rounded-xl border border-info/20 bg-info/5 p-5">
              <div class="mb-1 text-3xl font-black text-info">{item.stat}</div>
              <div class="text-xs text-white/50">{item.label}</div>
            </div>
          {/each}
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="mb-10 flex flex-wrap gap-3">
      {#each tabs as tab (tab.id)}
        <button
          onclick={() => activeTab = tab.id}
          class="rounded-xl border px-5 py-3 text-sm font-semibold transition-all
            {activeTab === tab.id
              ? 'border-info bg-info/10 text-info'
              : 'border-white/10 bg-base-200 text-white/50 hover:border-white/20 hover:text-white'}"
        >
          {tab.label}
        </button>
      {/each}
    </div>

    <!-- Social Ads -->
    {#if activeTab === 'social'}
    <div class="space-y-8">
      <div class="rounded-2xl border border-white/10 bg-base-200 p-8">
        <h2 class="mb-2 text-2xl font-black text-white">Social Media Ad Creative</h2>
        <p class="mb-8 text-sm text-white/50">Facebook, Instagram, TikTok, LinkedIn — every platform, every format.</p>
        <div class="grid gap-6 md:grid-cols-2">
          <div>
            <h3 class="mb-4 text-sm font-bold uppercase tracking-widest text-info">What You Can Build</h3>
            <div class="space-y-4">
              {#each [
                { id: 'static', format: 'Static Image Ads', desc: 'Generate high-converting product images, lifestyle shots, and offer graphics in any aspect ratio.' },
                { id: 'video', format: 'Video Ad Creative', desc: 'Produce 4–8 second video ads with motion, 3D effects, and custom music — exactly what stops the scroll.' },
                { id: 'story', format: 'Story & Reel Ads', desc: '9:16 vertical content optimized for Stories and Reels, with sound effects and music baked in.' },
                { id: 'carousel', format: 'Carousel Assets', desc: 'Generate a family of related images with consistent visual style for multi-card carousel ads.' }
              ] as item (item.id)}
                <div class="rounded-xl border border-white/10 bg-base-300 p-4">
                  <p class="mb-1 text-sm font-bold text-white">{item.format}</p>
                  <p class="text-xs text-white/50">{item.desc}</p>
                </div>
              {/each}
            </div>
          </div>
          <div>
            <h3 class="mb-4 text-sm font-bold uppercase tracking-widest text-info">The Testing Advantage</h3>
            <p class="mb-4 text-sm leading-relaxed text-white/60">
              Winning at social ads means testing constantly. Most brands can't afford to test
              because each creative variant costs money to produce. With Content Factory,
              you can generate 10 creative variants in the time it takes an agency to brief a designer.
            </p>
            <div class="space-y-3">
              {#each socialAdvantages as item (item)}
                <div class="flex items-center gap-3 text-sm text-white/60">
                  <span class="text-info">✓</span> {item}
                </div>
              {/each}
            </div>
            <div class="mt-6">
              <a href="/texttoimage" class="btn btn-info btn-sm">🖼️ Start Creating Ad Assets →</a>
            </div>
          </div>
        </div>
      </div>

      <div class="rounded-2xl border border-white/10 bg-base-200 p-8">
        <h3 class="mb-6 text-lg font-bold text-white">Proven Ad Creative Prompts</h3>
        <div class="grid gap-4 md:grid-cols-2">
          {#each socialPrompts as item (item.label)}
            <div class="rounded-xl border border-white/10 bg-base-300 p-4">
              <p class="mb-2 text-xs font-bold uppercase tracking-widest text-info">{item.label}</p>
              <p class="font-mono text-xs text-white/60">{item.prompt}</p>
            </div>
          {/each}
        </div>
      </div>
    </div>
    {/if}

    <!-- Video Ads -->
    {#if activeTab === 'video'}
    <div class="space-y-8">
      <div class="rounded-2xl border border-white/10 bg-base-200 p-8">
        <h2 class="mb-2 text-2xl font-black text-white">Video Ad Production</h2>
        <p class="mb-8 text-sm text-white/50">Cinematic video ads with music, effects, and your branding — produced in minutes.</p>
        <div class="grid gap-6 md:grid-cols-3">
          {#each videoSteps as item (item.title)}
            <div class="rounded-xl border border-white/10 bg-base-300 p-6 text-center">
              <div class="mb-3 text-4xl">{item.icon}</div>
              <h3 class="mb-2 text-sm font-bold text-white">{item.title}</h3>
              <p class="text-xs text-white/50">{item.desc}</p>
            </div>
          {/each}
        </div>
        <div class="mt-8 rounded-xl border border-info/20 bg-info/5 p-6">
          <h3 class="mb-4 text-sm font-bold text-white">Video Ad Formats You Can Produce</h3>
          <div class="grid gap-3 md:grid-cols-2">
            {#each videoFormats as item (item)}
              <div class="flex items-center gap-2 text-xs text-white/60">
                <span class="text-info">✓</span> {item}
              </div>
            {/each}
          </div>
        </div>
        <div class="mt-6">
          <a href="/texttovideo" class="btn btn-info btn-sm">🎬 Start Producing Video Ads →</a>
        </div>
      </div>
    </div>
    {/if}

    <!-- Display Ads -->
    {#if activeTab === 'display'}
    <div class="space-y-8">
      <div class="rounded-2xl border border-white/10 bg-base-200 p-8">
        <h2 class="mb-2 text-2xl font-black text-white">Display & Banner Ad Creative</h2>
        <p class="mb-8 text-sm text-white/50">High-quality visual assets for Google Display, programmatic, and retargeting campaigns.</p>
        <div class="grid gap-6 md:grid-cols-2">
          <div>
            <h3 class="mb-4 text-sm font-bold uppercase tracking-widest text-info">What You Can Build</h3>
            <div class="space-y-3">
              {#each displayAssets as item (item.label)}
                <div class="rounded-lg border border-white/10 bg-base-300 p-4">
                  <p class="mb-1 text-sm font-bold text-white">{item.label}</p>
                  <p class="text-xs text-white/50">{item.desc}</p>
                </div>
              {/each}
            </div>
          </div>
          <div>
            <h3 class="mb-4 text-sm font-bold uppercase tracking-widest text-info">The Display Advantage</h3>
            <p class="mb-4 text-sm leading-relaxed text-white/60">
              Display advertising is a volume game — you need fresh creative constantly
              to avoid banner blindness. Most advertisers refresh creative quarterly because
              production is expensive. With Content Factory you can refresh weekly or even daily.
            </p>
            <div class="rounded-xl border border-info/20 bg-info/5 p-4">
              <p class="mb-2 text-xs font-bold text-info">Pro Tip</p>
              <p class="text-xs text-white/60">
                Use Image Edit's ultra-refinement to ensure your display ad imagery
                meets the high-quality bar that premium publishers require.
                The identity-preserving technology keeps your product or spokesperson
                consistent across every variant.
              </p>
            </div>
            <div class="mt-6">
              <a href="/texttoimage" class="btn btn-info btn-sm">🖼️ Create Display Assets →</a>
            </div>
          </div>
        </div>
      </div>
    </div>
    {/if}

    <!-- Email Campaigns -->
    {#if activeTab === 'email'}
    <div class="space-y-8">
      <div class="rounded-2xl border border-white/10 bg-base-200 p-8">
        <h2 class="mb-2 text-2xl font-black text-white">Email Campaign Visual Assets</h2>
        <p class="mb-8 text-sm text-white/50">Emails with strong visuals get higher open rates, click rates, and conversions.</p>
        <div class="grid gap-6 md:grid-cols-2">
          <div class="space-y-4">
            {#each emailAssets as item (item.label)}
              <div class="rounded-xl border border-white/10 bg-base-300 p-5">
                <p class="mb-2 text-sm font-bold text-white">{item.label}</p>
                <p class="text-xs leading-relaxed text-white/50">{item.desc}</p>
              </div>
            {/each}
          </div>
          <div>
            <div class="rounded-xl border border-info/20 bg-info/5 p-6 mb-6">
              <h3 class="mb-3 text-sm font-bold text-white">Email Visual Best Practices</h3>
              <div class="space-y-2">
                {#each emailTips as tip (tip)}
                  <div class="flex items-start gap-2 text-xs text-white/60">
                    <span class="mt-0.5 text-info">→</span> {tip}
                  </div>
                {/each}
              </div>
            </div>
            <div class="rounded-xl border border-white/10 bg-base-300 p-6">
              <h3 class="mb-3 text-sm font-bold text-white">Workflow for Email Campaigns</h3>
              <div class="space-y-3">
                {#each emailWorkflow as item (item.step)}
                  <div class="flex items-center gap-3 text-xs text-white/60">
                    <span class="font-bold text-info">{item.step}</span>
                    <span>{item.action}</span>
                  </div>
                {/each}
              </div>
            </div>
            <div class="mt-6">
              <a href="/texttoimage" class="btn btn-info btn-sm">🖼️ Create Email Visuals →</a>
            </div>
          </div>
        </div>
      </div>
    </div>
    {/if}

    <!-- CTA -->
    <div class="mt-20 rounded-2xl border border-info/20 bg-info/5 p-12 text-center">
      <h2 class="mb-4 text-3xl font-black text-white">Ready to Outproduce Your Competition?</h2>
      <p class="mb-8 text-white/50">Start generating ad creative today — free, no credit card required.</p>
      <div class="flex flex-col items-center justify-center gap-4 sm:flex-row">
        <a href="/texttoimage" class="btn btn-info btn-lg">🖼️ Create Ad Images</a>
        <a href="/texttovideo" class="btn btn-outline btn-lg text-white hover:btn-info">🎬 Create Ad Videos</a>
      </div>
    </div>

  </div>
</div>