// src/lib/stores/editHistory.store.ts
// Snapshot-based undo/redo for the timeline editor (Ctrl+Z / Ctrl+Y).
//
// A checkpoint is taken at the START of every user-level gesture (drag begin,
// delete, split, paste, place…), so one undo reverses one whole gesture — not
// each mousemove tick. Snapshots capture the timeline tracks PLUS the audio
// state the timeline mirrors (music entries, sfx instances); restoring only the
// tracks would let TimelineEditor's sync effects immediately stomp them back.

import { writable, get } from 'svelte/store';
import { timelineStore, type TimelineTrack } from './timeline.store';
import { audioStudioStore, type MusicEntry, type SfxInstance } from './audioStudio.store';

interface EditSnapshot {
	tracks: TimelineTrack[];
	activeTrackId: string | null;
	musicEntries: Record<string, MusicEntry>;
	sfxInstances: SfxInstance[];
}

const MAX_HISTORY = 50;

let undoStack: EditSnapshot[] = [];
let redoStack: EditSnapshot[] = [];

// Reactive flags for UI (button disabled states)
export const editHistoryState = writable({ canUndo: false, canRedo: false });

function publish() {
	editHistoryState.set({ canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 });
}

function takeSnapshot(): EditSnapshot {
	const t = get(timelineStore);
	const a = get(audioStudioStore);
	return structuredClone({
		tracks: t.tracks,
		activeTrackId: t.activeTrackId,
		musicEntries: a.musicEntries,
		sfxInstances: a.sfxInstances
	});
}

function applySnapshot(snap: EditSnapshot) {
	// Audio first — timeline restore triggers editor sync effects that read it
	audioStudioStore.restoreForHistory(snap.musicEntries, snap.sfxInstances);
	timelineStore.restoreState(structuredClone(snap.tracks), snap.activeTrackId);
}

// Snapshot taken at drag-gesture start, committed only if the gesture changed state
let pendingGesture: EditSnapshot | null = null;

export const editHistory = {
	// For instantaneous ops that always mutate (delete, split, paste, place…)
	checkpoint() {
		const snap = takeSnapshot();
		const top = undoStack[undoStack.length - 1];
		// Op that changed nothing — don't burn a level
		if (top && JSON.stringify(top) === JSON.stringify(snap)) return;
		undoStack.push(snap);
		if (undoStack.length > MAX_HISTORY) undoStack.shift();
		redoStack = [];
		publish();
	},

	// For drags/resizes: snapshot at mousedown, commit at mouseup ONLY if state
	// changed. A plain click on a clip (focus, no movement) must not become an
	// undo step — that made menu-Undo restore the state you were already in.
	beginGesture() {
		pendingGesture = takeSnapshot();
	},

	endGesture() {
		if (!pendingGesture) return;
		const snap = pendingGesture;
		pendingGesture = null;
		if (JSON.stringify(snap) === JSON.stringify(takeSnapshot())) return; // no-op gesture
		undoStack.push(snap);
		if (undoStack.length > MAX_HISTORY) undoStack.shift();
		redoStack = [];
		publish();
	},

	undo(): boolean {
		const snap = undoStack.pop();
		if (!snap) return false;
		redoStack.push(takeSnapshot());
		applySnapshot(snap);
		publish();
		return true;
	},

	redo(): boolean {
		const snap = redoStack.pop();
		if (!snap) return false;
		undoStack.push(takeSnapshot());
		applySnapshot(snap);
		publish();
		return true;
	},

	clear() {
		undoStack = [];
		redoStack = [];
		pendingGesture = null;
		publish();
	}
};
