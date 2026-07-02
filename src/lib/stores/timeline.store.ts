// src/lib/stores/timeline.store.ts
// Dynamic track + clip model for the timeline.
// Owns clip positions. Components read from here and sync to audioStudio for playback.

import { writable } from 'svelte/store';

export type TrackType = 'video' | 'music' | 'sfx' | 'voice';

export interface TimelineClip {
	id: string;
	assetId: string;
	startTime: number;   // position on the output timeline (seconds)
	endTime: number;
	sourceStart: number; // trim in within the source asset
	sourceEnd: number;   // trim out
}

export interface TimelineTrack {
	id: string;
	type: TrackType;
	name: string;
	color: string;
	assetId: string;
	assetSessionId: string | null; // sfxSessionId / musicSessionId for playback lookup
	clips: TimelineClip[];
	muted: boolean;
	zIndex: number; // video tracks: lower index = rendered on top
}

interface TimelineState {
	tracks: TimelineTrack[];
	activeTrackId: string | null;
}

export const TRACK_COLORS: Record<TrackType, string> = {
	video:  'rgba(75,85,99,0.7)',
	music:  'rgba(147,51,234,0.7)',
	sfx:    'rgba(37,99,235,0.7)',
	voice:  'rgba(249,115,22,0.7)',
};

function makeId() { return Math.random().toString(36).slice(2, 9); }

function createTimelineStore() {
	const { subscribe, update } = writable<TimelineState>({
		tracks: [],
		activeTrackId: null
	});

	function addTrack(track: Omit<TimelineTrack, 'id'>): string {
		const id = makeId();
		update((s) => ({ ...s, tracks: [...s.tracks, { ...track, id }] }));
		return id;
	}

	return {
		subscribe,

		// ── TRACK CREATION ───────────────────────────────────────────────
		addVideoTrack(assetId: string, name: string, duration: number, startAt = 0): string {
			const clipId = makeId();
			return addTrack({
				type: 'video',
				name,
				color: TRACK_COLORS.video,
				assetId,
				assetSessionId: null,
				muted: false,
				zIndex: 0,
				clips: [{
					id: clipId,
					assetId,
					startTime: startAt,
					endTime: startAt + duration,
					sourceStart: 0,
					sourceEnd: duration
				}]
			});
		},

		addMusicTrack(
			assetId: string,
			name: string,
			sessionId: string,
			startTime: number,
			endTime: number
		): string {
			const clipId = makeId();
			return addTrack({
				type: 'music',
				name,
				color: TRACK_COLORS.music,
				assetId,
				assetSessionId: sessionId,
				muted: false,
				zIndex: 0,
				clips: [{
					id: clipId,
					assetId,
					startTime,
					endTime,
					sourceStart: 0,
					sourceEnd: endTime - startTime
				}]
			});
		},

		addSfxTrack(
			assetId: string,
			name: string,
			sessionId: string,
			instances: Array<{ id: string; startTime: number; endTime: number }>
		): string {
			return addTrack({
				type: 'sfx',
				name,
				color: TRACK_COLORS.sfx,
				assetId,
				assetSessionId: sessionId,
				muted: false,
				zIndex: 0,
				clips: instances.map((inst) => ({
					id: inst.id,
					assetId,
					startTime: inst.startTime,
					endTime: inst.endTime,
					sourceStart: 0,
					sourceEnd: inst.endTime - inst.startTime
				}))
			});
		},

		// ── TRACK MANAGEMENT ─────────────────────────────────────────────
		removeTrack(trackId: string) {
			update((s) => ({
				...s,
				tracks: s.tracks.filter((t) => t.id !== trackId),
				activeTrackId: s.activeTrackId === trackId ? null : s.activeTrackId
			}));
		},

		setActiveTrack(trackId: string | null) {
			update((s) => ({ ...s, activeTrackId: trackId }));
		},

		muteTrack(trackId: string, muted: boolean) {
			update((s) => ({
				...s,
				tracks: s.tracks.map((t) => (t.id === trackId ? { ...t, muted } : t))
			}));
		},

		renameTrack(trackId: string, name: string) {
			update((s) => ({
				...s,
				tracks: s.tracks.map((t) => (t.id === trackId ? { ...t, name } : t))
			}));
		},

		// ── CLIP UPDATES ─────────────────────────────────────────────────
		updateClip(trackId: string, clipId: string, patch: Partial<TimelineClip>) {
			update((s) => ({
				...s,
				tracks: s.tracks.map((t) =>
					t.id !== trackId
						? t
						: { ...t, clips: t.clips.map((c) => (c.id === clipId ? { ...c, ...patch } : c)) }
				)
			}));
		},

		// Keeps duration constant — just shifts position
		moveClip(trackId: string, clipId: string, newStart: number) {
			update((s) => ({
				...s,
				tracks: s.tracks.map((t) => {
					if (t.id !== trackId) return t;
					return {
						...t,
						clips: t.clips.map((c) => {
							if (c.id !== clipId) return c;
							const dur = c.endTime - c.startTime;
							const s2 = Math.max(0, newStart);
							return { ...c, startTime: s2, endTime: s2 + dur };
						})
					};
				})
			}));
		},

		// Replace sfx track clips in bulk (mirrors audioStudio.sfxInstances)
		syncSfxClips(
			trackId: string,
			instances: Array<{ id: string; startTime: number; endTime: number }>,
			assetId: string
		) {
			update((s) => ({
				...s,
				tracks: s.tracks.map((t) =>
					t.id !== trackId
						? t
						: {
								...t,
								clips: instances.map((inst) => ({
									id: inst.id,
									assetId,
									startTime: inst.startTime,
									endTime: inst.endTime,
									sourceStart: 0,
									sourceEnd: inst.endTime - inst.startTime
								}))
						  }
				)
			}));
		},

		// Split one clip into two at a given timeline time
		splitClip(trackId: string, clipId: string, splitAt: number) {
			update((s) => {
				const track = s.tracks.find(t => t.id === trackId);
				if (!track) return s;
				const clip = track.clips.find(c => c.id === clipId);
				if (!clip) return s;
				if (splitAt <= clip.startTime + 0.1 || splitAt >= clip.endTime - 0.1) return s;

				const sourceSplit = clip.sourceStart + (splitAt - clip.startTime);
				const clipA: TimelineClip = { ...clip, endTime: splitAt, sourceEnd: sourceSplit };
				const clipB: TimelineClip = {
					id: makeId(), assetId: clip.assetId,
					startTime: splitAt, endTime: clip.endTime,
					sourceStart: sourceSplit, sourceEnd: clip.sourceEnd
				};

				return {
					...s,
					tracks: s.tracks.map(t => t.id !== trackId ? t : {
						...t,
						clips: [...t.clips.filter(c => c.id !== clipId), clipA, clipB]
							.sort((a, b) => a.startTime - b.startTime)
					})
				};
			});
		},

		// Insert a clip at an arbitrary position (used by paste)
		insertClip(trackId: string, clip: Omit<TimelineClip, 'id'>) {
			const id = makeId();
			update((s) => ({
				...s,
				tracks: s.tracks.map(t => t.id !== trackId ? t : {
					...t,
					clips: [...t.clips, { ...clip, id }].sort((a, b) => a.startTime - b.startTime)
				})
			}));
			return id;
		},

		// Remove a single clip. Auto-removes the track if it becomes empty.
		removeClip(trackId: string, clipId: string) {
			update((s) => {
				const track = s.tracks.find(t => t.id === trackId);
				if (!track) return s;
				const remaining = track.clips.filter(c => c.id !== clipId);
				if (remaining.length === 0) {
					return {
						...s,
						tracks: s.tracks.filter(t => t.id !== trackId),
						activeTrackId: s.activeTrackId === trackId ? null : s.activeTrackId
					};
				}
				return {
					...s,
					tracks: s.tracks.map(t => t.id !== trackId ? t : { ...t, clips: remaining })
				};
			});
		},

		// Duplicate a clip — places copy immediately after the original
		duplicateClip(trackId: string, clipId: string) {
			update((s) => {
				const track = s.tracks.find(t => t.id === trackId);
				if (!track) return s;
				const clip = track.clips.find(c => c.id === clipId);
				if (!clip) return s;
				const dur = clip.endTime - clip.startTime;
				const copy: TimelineClip = {
					...clip,
					id: makeId(),
					startTime: clip.endTime + 0.1,
					endTime: clip.endTime + 0.1 + dur
				};
				return {
					...s,
					tracks: s.tracks.map(t => t.id !== trackId ? t : {
						...t,
						clips: [...t.clips, copy].sort((a, b) => a.startTime - b.startTime)
					})
				};
			});
		},

		// Find the track id for a given sessionId (for playback lookup)
		findBySession(sessionId: string): TimelineTrack | undefined {
			let found: TimelineTrack | undefined;
			const unsub = subscribe((s) => {
				found = s.tracks.find((t) => t.assetSessionId === sessionId);
			});
			unsub();
			return found;
		},

		clearAll() {
			update(() => ({ tracks: [], activeTrackId: null }));
		}
	};
}

export const timelineStore = createTimelineStore();
