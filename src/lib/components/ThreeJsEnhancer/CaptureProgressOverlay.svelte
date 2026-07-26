<!-- CaptureProgressOverlay.svelte -->
<script lang="ts">
  export let progress: number = 0;
  export let message: string = '';
  export let isVisible: boolean = false;
  export let encodingStarted: boolean = false;
  export let onDismiss: () => void = () => {};
</script>

{#if isVisible}
  <!-- Solid backdrop, no backdrop-blur — blur re-filters everything beneath it
       on every repaint, which is exactly the GPU we're trying to hand to the
       encoder during capture. -->
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/95">
    <div class="mx-4 w-full max-w-lg rounded-xl border border-white/10 bg-gray-900 p-8 shadow-2xl">

      {#if encodingStarted}
        <!-- ENCODING STARTED — You're free to go -->
        <div class="mb-6 flex justify-center">
          <div class="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/20 border border-green-500/40">
            <span class="text-4xl">🎬</span>
          </div>
        </div>

        <h3 class="mb-3 text-center text-2xl font-bold text-white">Your Video is Encoding!</h3>

        <p class="mb-4 text-center text-base text-gray-300 leading-relaxed">
          You're free to navigate away — your video will be <span class="text-green-400 font-semibold">automatically saved to your library</span> when it's ready.
        </p>

            <div class="mb-4 rounded-lg border border-blue-500/30 bg-blue-900/20 p-4">
      <p class="mb-2 text-center text-sm font-semibold text-blue-300">⚙️ What's happening right now:</p>
      <p class="text-center text-sm text-gray-300 leading-relaxed">
        We're finishing your 3D enhanced video — mixing your audio tracks and packaging everything into a cinema-quality MP4. This usually takes <span class="text-white font-semibold">just a few minutes</span>, and it lands in your library automatically.
      </p>
</div>

<!-- NEW: Add comparison section -->
<div class="mb-6 rounded-lg border border-green-500/30 bg-green-900/20 p-4">
  <p class="mb-2 text-center text-sm font-semibold text-green-300">💡 Why this is still FAST:</p>
  <div class="space-y-1 text-left text-xs text-gray-300">
    <p>• <span class="text-red-400 line-through">CapCut manual edit:</span> 4-8 hours</p>
    <p>• <span class="text-red-400 line-through">Premiere Pro workflow:</span> 2-3 hours + render</p>
    <p>• <span class="text-green-400 font-semibold">✓ Content Factory:</span> minutes, fully automated</p>
  </div>
  <p class="mt-2 text-center text-xs text-green-200">
    You're getting <span class="font-bold">professional 3D effects in a fraction of the time!</span> ⚡
  </p>
</div>

        <div class="mb-6 rounded-lg border border-green-500/30 bg-green-900/20 p-3">
          <p class="text-center text-sm text-green-300">
            ✅ All frames captured & uploaded — encoding in progress
          </p>
        </div>

        <button
          on:click={onDismiss}
          class="w-full rounded-lg bg-blue-600 px-6 py-3 text-base font-bold text-white transition-colors hover:bg-blue-500"
        >
          Got it, I'll check my library when it's ready →
        </button>

      {:else}
            <!-- CAPTURING STATE — deliberately animation-free. A CSS spinner or
                 bar transition keeps the compositor running at 60Hz for the whole
                 capture, and on an iGPU that compositing starves the encoder
                 (measured ~15× slower). The bar advancing ~2×/sec IS the life sign. -->
            <div class="mb-4 flex justify-center">
              <div class="flex h-16 w-16 items-center justify-center rounded-full border-4 border-blue-500/40 bg-blue-500/10">
                <span class="text-2xl">🎬</span>
              </div>
            </div>

            <h3 class="mb-2 text-center text-xl font-bold text-white">Capturing Enhanced Video</h3>

            <p class="mb-4 text-center text-sm text-gray-400">
              {message || 'Please wait...'}
            </p>

            <!-- No width transition — same reason as above, it re-composites for
                 300ms after every update instead of one cheap repaint. -->
            <div class="mb-2 h-3 w-full overflow-hidden rounded-full bg-gray-700">
              <div
                class="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-600"
                style="width: {progress}%"
              ></div>
            </div>

            <p class="text-center text-xs text-gray-500 mb-4">
              {Math.round(progress)}% complete
            </p>

            <!-- NEW: Add educational context DURING capture -->
            <div class="mb-4 rounded-lg border border-blue-500/30 bg-blue-900/20 p-3">
              <p class="mb-2 text-center text-xs font-semibold text-blue-300">⚙️ Rendering 3D effects frame-by-frame</p>
              <p class="text-center text-[11px] text-gray-300 leading-relaxed">
                Every frame is rendered at full 1080p quality — effects, text and audio baked in exactly as you previewed them. Usually done in <span class="text-green-400 font-semibold">minutes</span>, not hours.
              </p>
            </div>

            <!-- Quick comparison -->
            <div class="mb-4 rounded-lg border border-green-500/30 bg-green-900/20 p-3">
              <div class="space-y-0.5 text-[11px] text-gray-300">
                <p>• <span class="text-red-400">CapCut:</span> 4-8 hours manual work</p>
                <p>• <span class="text-red-400">Premiere:</span> 2-3 hours + render</p>
                <p>• <span class="text-green-400 font-semibold">✓ This tool:</span> minutes, automated</p>
              </div>
            </div>

            <div class="rounded border border-blue-500/30 bg-blue-900/20 p-3">
              <p class="text-center text-xs text-blue-200">
                Keep this tab open — you're free to work in another window while we render.
              </p>
            </div>
      {/if}

    </div>
  </div>
{/if}

