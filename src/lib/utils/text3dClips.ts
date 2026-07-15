// src/lib/utils/text3dClips.ts
// Places a NEW 3D text instance on the timeline: snapshots the accordion's
// current styling into text3DState.entries, registers a 'text3d' media-bin
// asset carrying the entry id, and drops a bar at the playhead. The bar IS the
// instance's timing (visibility window + fades); focusing the bar makes the
// ✨ 3D Text accordion edit that instance.

import { get } from 'svelte/store';
import { text3DState } from '$lib/stores/text3d.store';
import { timelineStore } from '$lib/stores/timeline.store';
import { mediaBinStore } from '$lib/stores/mediaBin.store';
import { editHistory } from '$lib/stores/editHistory.store';

const DEFAULT_TEXT3D_DURATION = 5;

export function addText3DInstance(): void {
	const start = ((window as any).__timelineEditTime as number | null) ?? 0;
	const entryId = Math.random().toString(36).slice(2, 9);
	editHistory.checkpoint();
	text3DState.addEntry(entryId);
	const label = (get(text3DState).text || '3D Text').split('\n')[0].slice(0, 24);
	const assetId = mediaBinStore.addAsset({
		type: 'text3d',
		name: '✨ ' + label,
		sessionId: null,
		previewUrl: null,
		duration: DEFAULT_TEXT3D_DURATION,
		text3dId: entryId
	});
	const trackId = timelineStore.addVideoTrack(assetId, label, DEFAULT_TEXT3D_DURATION, start);
	// Focus the new bar so the Selected Clip panel + accordion point at it
	const track = get(timelineStore).tracks.find((t) => t.id === trackId);
	if (track?.clips[0]) timelineStore.setActiveClip(trackId, track.clips[0].id);
}
