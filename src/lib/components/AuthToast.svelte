<script lang="ts">
    import AuthModal from '$lib/components/AuthModal.svelte';

    let showAuthModal = $state(false);
    let visible = $state(false);
    let timeout: ReturnType<typeof setTimeout> | null = null;

    export function show() {
        visible = true;
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => { visible = false; }, 6000);
    }

    export function hide() {
        visible = false;
        if (timeout) clearTimeout(timeout);
    }
</script>

{#if visible}
    <div class="toast toast-top toast-center z-[9999]">
        <div class="alert alert-info shadow-2xl flex flex-col gap-2 max-w-sm">
            <div class="flex items-center gap-2">
                <span class="text-2xl">🔒</span>
                <div>
                    <p class="font-bold text-base">Sign in required</p>
                    <p class="text-sm">You need to be signed in to use this tool.</p>
                </div>
                <button onclick={hide} class="btn btn-ghost btn-xs ml-auto">✕</button>
            </div>
            <button 
                onclick={() => { showAuthModal = true; hide(); }} 
                class="btn btn-default btn-sm w-full">
                Sign In Now
            </button>
        </div>
    </div>
{/if}

<AuthModal bind:isOpen={showAuthModal} />