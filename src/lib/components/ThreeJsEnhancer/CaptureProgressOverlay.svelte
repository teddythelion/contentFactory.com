<!-- CaptureProgressOverlay.svelte -->
<script lang="ts">
  export let progress: number = 0;
  export let message: string = '';
  export let isVisible: boolean = false;
  export let encodingStarted: boolean = false;
  export let onDismiss: () => void = () => {};
</script>

{#if isVisible}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
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

        <div class="mb-6 rounded-lg border border-blue-500/30 bg-blue-900/20 p-4">
          <p class="mb-2 text-center text-sm font-semibold text-blue-300">⚙️ What's happening right now:</p>
          <p class="text-center text-sm text-gray-300 leading-relaxed">
            We're compiling your 3D enhanced video frame by frame — rendering each frame at full quality, converting them, and encoding everything into a finished MP4. This process typically takes <span class="text-white font-semibold">2 to 10 minutes</span> depending on video length and server load.
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
        <!-- CAPTURING STATE — progress bar -->
        <div class="mb-4 flex justify-center">
          <div class="relative">
            <svg class="h-16 w-16 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <div class="absolute inset-0 flex items-center justify-center">
              <span class="text-2xl">🎬</span>
            </div>
          </div>
        </div>

        <h3 class="mb-2 text-center text-xl font-bold text-white">Capturing Video</h3>

        <p class="mb-6 text-center text-sm text-gray-400">
          {message || 'Please wait...'}
        </p>

        <div class="mb-2 h-3 w-full overflow-hidden rounded-full bg-gray-700">
          <div
            class="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300 ease-out"
            style="width: {progress}%"
          ></div>
        </div>

        <p class="text-center text-xs text-gray-500 mb-6">
          {Math.round(progress)}% complete
        </p>

        <div class="rounded border border-yellow-500/30 bg-yellow-900/20 p-3">
          <p class="text-center text-xs text-yellow-300">
            ⚠️ Stay on this page while frames are being captured
          </p>
        </div>
      {/if}

    </div>
  </div>
{/if}

<style>
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .animate-spin {
    animation: spin 1s linear infinite;
  }
</style>