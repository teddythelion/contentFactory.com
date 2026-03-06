<script lang="ts">
  import './layout.css';
  import favicon from '$lib/assets/favicon.svg';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { encodeJobStore } from '$lib/stores/encodeJob.store';

  let { children } = $props();

  let toastVisible = $state(false);
  let toastMessage = $state('');
  let toastType = $state<'success' | 'error'>('success');
  let toastTimeout: ReturnType<typeof setTimeout> | null = null;
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    if (toastTimeout) clearTimeout(toastTimeout);
    toastMessage = message;
    toastType = type;
    toastVisible = true;
    toastTimeout = setTimeout(() => { toastVisible = false; }, 30000);
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
          showToast('✅ Your enhanced video has been saved to your library!', 'success');
          // Navigate to library after 2 seconds
          setTimeout(() => {
            goto('/content-library');
          }, 2000);
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
    const unsubscribe = encodeJobStore.subscribe((job) => {
      if (job?.status === 'processing' && !pollInterval) {
        startPolling(job.jobId);
      }
    });

    return () => {
      unsubscribe();
      if (pollInterval) clearInterval(pollInterval);
      if (toastTimeout) clearTimeout(toastTimeout);
    };
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
</svelte:head>

{#if toastVisible}
  <div class="encode-toast {toastType}" role="alert">
    <div class="toast-icon">{toastType === 'success' ? '✅' : '❌'}</div>
    <div class="toast-body">
      <p class="toast-title">{toastType === 'success' ? 'Video Ready!' : 'Encoding Failed'}</p>
      <p class="toast-message">{toastMessage}</p>
    </div>
    <button onclick={() => { toastVisible = false; }} aria-label="Dismiss">✕</button>
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
    align-items: flex-start;
    gap: 14px;
    padding: 18px 20px;
    border-radius: 12px;
    max-width: 440px;
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.4);
    animation: slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .encode-toast.success {
    background: #0f2318;
    border: 1.5px solid #4ade80;
  }

  .encode-toast.error {
    background: #230f0f;
    border: 1.5px solid #f87171;
  }

  .toast-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .toast-body {
    flex: 1;
  }

  .toast-title {
    font-size: 1rem;
    font-weight: 700;
    color: #ffffff;
    margin-bottom: 4px;
  }

  .toast-message {
    font-size: 0.875rem;
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.8);
  }

  .encode-toast button {
    background: none;
    border: none;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.5);
    font-size: 1rem;
    padding: 0;
    flex-shrink: 0;
    margin-top: 2px;
    transition: color 0.2s;
  }

  .encode-toast button:hover {
    color: rgba(255, 255, 255, 0.9);
  }

  @keyframes slideIn {
    from { transform: translateY(30px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
</style>