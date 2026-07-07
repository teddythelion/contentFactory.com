// src/lib/stores/mediaBin.store.ts
// Registry of all uploaded/generated assets — videos, audio, music, SFX, voice.
// armedAssetId = the clip tapped in the bin and ready to be placed on the timeline.

import { writable } from 'svelte/store';

export type AssetType = 'video' | 'image' | 'music' | 'sfx' | 'voice';

export interface MediaAsset {
	id: string;
	type: AssetType;
	name: string;
	sessionId: string | null;  // server-side file id (audioSessionId, sfxSessionId, etc.)
	previewUrl: string | null; // object URL for in-browser preview
	duration: number;          // seconds
	thumbnailUrl?: string;
	createdAt: number;
}

interface MediaBinState {
	assets: MediaAsset[];
	armedAssetId: string | null;
}

function makeId() { return Math.random().toString(36).slice(2, 9); }

function createMediaBinStore() {
	const { subscribe, update } = writable<MediaBinState>({ assets: [], armedAssetId: null });

	return {
		subscribe,

		// Returns the new asset id
		addAsset(asset: Omit<MediaAsset, 'id' | 'createdAt'>): string {
			const id = makeId();
			update((s) => ({
				...s,
				assets: [...s.assets, { ...asset, id, createdAt: Date.now() }]
			}));
			return id;
		},

		// Update fields on an existing asset (e.g. duration becomes known after decode)
		updateAsset(id: string, patch: Partial<Omit<MediaAsset, 'id'>>) {
			update((s) => ({
				...s,
				assets: s.assets.map((a) => (a.id === id ? { ...a, ...patch } : a))
			}));
		},

		removeAsset(id: string) {
			update((s) => ({
				...s,
				assets: s.assets.filter((a) => a.id !== id),
				armedAssetId: s.armedAssetId === id ? null : s.armedAssetId
			}));
		},

		// Toggle selection — tap once to arm, tap again to disarm
		toggleArm(id: string) {
			update((s) => ({ ...s, armedAssetId: s.armedAssetId === id ? null : id }));
		},

		disarm() {
			update((s) => ({ ...s, armedAssetId: null }));
		},

		clearAll() {
			update(() => ({ assets: [], armedAssetId: null }));
		}
	};
}

export const mediaBinStore = createMediaBinStore();
