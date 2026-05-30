// src/lib/stores/encodeJob.store.ts
// Persists the active encode job across page navigation using localStorage

import { writable } from 'svelte/store';

interface EncodeJob {
  jobId: string;
  status: 'processing' | 'complete' | 'error';
  gcsUrl?: string;
  error?: string;
}

function createEncodeJobStore() {
  // Rehydrate from localStorage on init so navigation doesn't lose the job
  const stored = typeof localStorage !== 'undefined'
    ? localStorage.getItem('encodeJob')
    : null;

  const initial: EncodeJob | null = stored ? JSON.parse(stored) : null;

  const { subscribe, set, update } = writable<EncodeJob | null>(initial);

  return {
    subscribe,
    set: (job: EncodeJob | null) => {
      if (typeof localStorage !== 'undefined') {
        if (job) localStorage.setItem('encodeJob', JSON.stringify(job));
        else localStorage.removeItem('encodeJob');
      }
      set(job);
    },
    clear: () => {
      if (typeof localStorage !== 'undefined') localStorage.removeItem('encodeJob');
      set(null);
    }
  };
}

export const encodeJobStore = createEncodeJobStore();