<script lang="ts">
  import './layout.css';
  import favicon from '$lib/assets/favicon.svg';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import { onMount } from 'svelte';
  import { encodeJobStore } from '$lib/stores/encodeJob.store';

  let { children } = $props();

  // Toast state
  let toastVisible = $state(false);
  let toastMessage = $state('');
  let toastType = $state<'success' | 'error'>('success');
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    toastMessage = message;
    toastType = type;
    toastVisible = true;
    setTimeout(() => { toastVisible = false; }, 6000);
  }

  function triggerDownload(gcsUrl: string) {
    const link = document.createElement('a');
    link.href = gcsUrl;
    link.download = `enhanced-video-${Date.now()}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function startPolling(jobId: string) {
    if (pollInterval) clearInterval(pollInterval);

    pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/encodeStatus?jobId=${jobId}`);
        if (!res.ok) return;

        const job = await res.json();

        if (job.status === 'complete' && job.gcsUrl) {
          clearInterval(pollInterval!);
          pollInterval = null;
          encodeJobStore.clear();
          triggerDownload(job.gcsUrl);
          showToast('✅ Your enhanced video is ready! Downloading now...', 'success');
        } else if (job.status === 'error') {
          clearInterval(pollInterval!);
          pollInterval = null;
          encodeJobStore.clear();
          showToast(`❌ Encoding failed: ${job.error || 'Unknown error'}`, 'error');
        }
      } catch (e) {
        console.warn('Poll error (will retry):', e);
      }
    }, 5000);
  }

  onMount(() => {
    // Resume polling if there's an active job from a previous page
    const unsubscribe = encodeJobStore.subscribe((job) => {
      if (job?.status === 'processing' && !pollInterval) {
        startPolling(job.jobId);
      }
    });

    return () => {
      unsubscribe();
      if (pollInterval) clearInterval(pollInterval);
    };
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
</svelte:head>

<!-- Global encode toast notification -->
{#if toastVisible}
  <div
    class="encode-toast {toastType}"
    role="alert"
  >
    <span>{toastMessage}</span>
    <button onclick={() => toastVisible = false} aria-label="Dismiss">✕</button>
  </div>
{/if}

<Sidebar>
  {@render children()}
</Sidebar>

<Footer />

<style>
  .encode-toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    border-radius: 10px;
    font-size: 0.95rem;
    font-weight: 500;
    max-width: 420px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    animation: slideIn 0.3s ease;
  }

  .encode-toast.success {
    background: #1a2e1a;
    border: 1px solid #4ade80;
    color: #4ade80;
  }

  .encode-toast.error {
    background: #2e1a1a;
    border: 1px solid #f87171;
    color: #f87171;
  }

  .encode-toast button {
    background: none;
    border: none;
    cursor: pointer;
    color: inherit;
    opacity: 0.7;
    font-size: 1rem;
    padding: 0;
    margin-left: auto;
    flex-shrink: 0;
  }

  .encode-toast button:hover {
    opacity: 1;
  }

  @keyframes slideIn {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
</style>