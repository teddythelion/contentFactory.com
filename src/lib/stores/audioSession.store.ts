// src/lib/stores/audioSession.store.ts
// Holds the audioSessionId for the current enhance session.
// Written by ThreeJsEnhancer when it mounts, read by videoCapture.ts
// when kicking off the encode request.
// Cleared when the enhancer closes.

import { writable } from 'svelte/store';

function createAudioSessionStore() {
	const { subscribe, set } = writable<string | null>(null);

	return {
		subscribe,
		set: (id: string | null) => set(id),
		clear: () => set(null)
	};
}

export const audioSessionStore = createAudioSessionStore();
