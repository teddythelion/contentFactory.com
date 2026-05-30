<script lang="ts">
  import './layout.css';
  import favicon from '$lib/assets/favicon.svg';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { encodeJobStore } from '$lib/stores/encodeJob.store';
  import { authStore } from '$lib/stores/auth.store';

  let { children } = $props();

  // Toast state
  let toastVisible = $state(false);
  let toastMessage = $state('');
  let toastType = $state<'success' | 'error'>('success');
  let toastTimeout: ReturnType<typeof setTimeout> | null = null;
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  // Re-auth modal state
  let reAuthVisible = $state(false);
  let reAuthLoading = $state(false);

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
          setTimeout(() => { goto('/content-library'); }, 2000);
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

  // Global fetch interceptor — catches 401s anywhere in the app
  function installFetchInterceptor() {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (response.status === 401 && !reAuthVisible) {
        // Clone so the original response can still be read by caller
        reAuthVisible = true;
      }
      return response;
    };
  }
 // Inactivity re-auth — force login if away 8+ hours
  if (typeof window !== 'undefined') {
    const INACTIVITY_LIMIT = 8 * 60 * 60 * 1000;
    const lastActive = localStorage.getItem('lastActive');

    if (lastActive && Date.now() - parseInt(lastActive) > INACTIVITY_LIMIT) {
      localStorage.removeItem('lastActive');
      authStore.signOut().then(() => {
        reAuthVisible = true;
      });
    }

    localStorage.setItem('lastActive', Date.now().toString());

    window.addEventListener('focus', () => {
      const last = localStorage.getItem('lastActive');
      if (last && Date.now() - parseInt(last) > INACTIVITY_LIMIT) {
        authStore.signOut();
        reAuthVisible = true;
      }
      localStorage.setItem('lastActive', Date.now().toString());
    });
  }

  async function handleReAuth() {
    reAuthLoading = true;
    try {
      const result = await authStore.signInWithGoogle();
      if (result.success) {
        reAuthVisible = false;
      }
    } catch (e) {
      console.error('Re-auth failed:', e);
    } finally {
      reAuthLoading = false;
    }
  }

  onMount(() => {
    installFetchInterceptor();

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

<!-- Re-auth modal -->
{#if reAuthVisible}
  <div class="reauth-overlay">
    <div class="reauth-modal">
      <div class="reauth-icon">🔒</div>
      <h3 class="reauth-title">Session Expired</h3>
      <p class="reauth-message">Your session has expired. Please sign in again to continue — it only takes a second.</p>
      <button
        class="reauth-btn"
        onclick={handleReAuth}
        disabled={reAuthLoading}
      >
        {#if reAuthLoading}
          <span class="reauth-spinner"></span> Signing in...
        {:else}
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" class="google-icon" />
          Sign in with Google
        {/if}
      </button>
    </div>
  </div>
{/if}

<!-- Global encode toast -->
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
  /* Re-auth modal */
  .reauth-overlay {
    position: fixed;
    inset: 0;
    z-index: 99999;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .reauth-modal {
    background: #111827;
    border: 1.5px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 40px 36px;
    max-width: 380px;
    width: 90%;
    text-align: center;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
    animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .reauth-icon {
    font-size: 2.5rem;
    margin-bottom: 16px;
  }

  .reauth-title {
    font-size: 1.4rem;
    font-weight: 700;
    color: #ffffff;
    margin-bottom: 10px;
  }

  .reauth-message {
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.6);
    line-height: 1.6;
    margin-bottom: 28px;
  }

  .reauth-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    padding: 14px 20px;
    background: #ffffff;
    color: #1a1a1a;
    border: none;
    border-radius: 10px;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s, opacity 0.2s;
  }

  .reauth-btn:hover:not(:disabled) {
    background: #f0f0f0;
  }

  .reauth-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .google-icon {
    width: 20px;
    height: 20px;
  }

  .reauth-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid #1a1a1a;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    display: inline-block;
  }

  /* Toast */
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

  .toast-body { flex: 1; }

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

  .encode-toast button:hover { color: rgba(255, 255, 255, 0.9); }

  @keyframes slideIn {
    from { transform: translateY(30px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>