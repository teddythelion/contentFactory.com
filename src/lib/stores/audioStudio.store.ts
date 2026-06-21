// src/lib/stores/audioStudio.store.ts
// All state changes flow through to audioMixer in real time.
// The mixer handles Web Audio API — what you hear = what gets exported.

import { writable, get } from 'svelte/store';
import { audioMixer, type MusicTrackState, type MusicClipState } from '$lib/utils/audioMixer.ts';
import { mediaBinStore } from './mediaBin.store';
import { timelineStore } from './timeline.store';
import { authStore } from './auth.store';

// Fire-and-forget: saves generated audio (data: URLs only) to the content library.
async function saveAudioToLibrary(previewUrl: string, title: string, prompt: string, duration: number) {
	if (!previewUrl.startsWith('data:')) return; // skip uploaded/blob URLs
	try {
		const uid = get(authStore).user?.uid;
		if (!uid) return;
		await fetch('/api/saveContent', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ fileUrl: previewUrl, type: 'audio', title, prompt, format: 'mp3', duration })
		});
	} catch {
		// silent fail — library save is best-effort
	}
}

export interface SfxInstance {
	id: string;
	startTime: number;
	endTime: number;
}

// Per-session music entry — display/meta state for the store and controls panel.
// Actual clip positions live in timelineStore; mixer reads from there via syncMusicToVideo.
export interface MusicEntry {
	sessionId: string;
	previewUrl: string;
	fileName: string | null;
	generating: boolean;
	error: string | null;
	prompt: string;
	volume: number;
	// Panel display values for the focused clip (updated by drag handlers)
	startTime: number;
	endTime: number;
	trimStart: number;
	fadeIn: number;
	fadeOut: number;
}

interface AudioStudioState {
	originalVolume: number;
	originalMuted: boolean;
	originalFadeIn: number;
	originalFadeOut: number;
	videoFadeIn: number;
	videoFadeOut: number;
	musicDuration: number;
	sfxPrompt: string;
	sfxSessionId: string | null;
	sfxPreviewUrl: string | null;
	sfxFileName: string | null;
	sfxVolume: number;
	sfxLoop: boolean;
	sfxGenerating: boolean;
	sfxError: string | null;
	sfxAudioDuration: number;
	sfxInstances: SfxInstance[];
	sfxFadeIn: number;
	sfxFadeOut: number;
	sfxSuppressOriginal: boolean;

	// Multi-track music: keyed by sessionId
	musicEntries: Record<string, MusicEntry>;
	activeMusicSessionId: string | null;
	// Legacy single-track fields kept for AudioStudioPanel UI compatibility
	musicPrompt: string;
	musicSessionId: string | null;
	musicPreviewUrl: string | null;
	musicFileName: string | null;
	musicVolume: number;
	musicGenerating: boolean;
	musicError: string | null;
	musicStartTime: number;
	musicEndTime: number;
	musicTrimStart: number;
	musicFadeIn: number;
	musicFadeOut: number;
	musicSuppressOriginal: boolean;
}

const initialState: AudioStudioState = {
	originalVolume: 1,
	originalMuted: false,
	originalFadeIn: 0,
	originalFadeOut: 0,
	videoFadeIn: 0,
	videoFadeOut: 0,
	musicDuration: 10,
	sfxPrompt: '',
	sfxSessionId: null,
	sfxPreviewUrl: null,
	sfxFileName: null,
	sfxVolume: 0.4,
	sfxLoop: false,
	sfxGenerating: false,
	sfxError: null,
	sfxAudioDuration: 0,
	sfxInstances: [],
	sfxFadeIn: 0,
	sfxFadeOut: 0,
	sfxSuppressOriginal: false,

	musicEntries: {},
	activeMusicSessionId: null,
	musicPrompt: '',
	musicSessionId: null,
	musicPreviewUrl: null,
	musicFileName: null,
	musicVolume: 0.3,
	musicGenerating: false,
	musicError: null,
	musicStartTime: 0,
	musicEndTime: 8,
	musicTrimStart: 0,
	musicFadeIn: 0,
	musicFadeOut: 0,
	musicSuppressOriginal: false
};

function makeId() {
	return Math.random().toString(36).slice(2, 9);
}

function createAudioStudioStore() {
	const { subscribe, set, update } = writable<AudioStudioState>(initialState);

	// Patch musicEntries[activeMusicSessionId] and also update the flat display field
	function patchActiveEntry(patch: Partial<MusicEntry>) {
		update((s) => {
			if (!s.activeMusicSessionId) return s;
			const existing = s.musicEntries[s.activeMusicSessionId];
			if (!existing) return s;
			return {
				...s,
				musicEntries: {
					...s.musicEntries,
					[s.activeMusicSessionId]: { ...existing, ...patch }
				}
			};
		});
	}

	function syncOriginalToMixer() {
		const s = get({ subscribe });
		const effectivelyMuted = s.originalMuted || s.sfxSuppressOriginal || s.musicSuppressOriginal;
		audioMixer.setOriginalMuted(effectivelyMuted);
		audioMixer.setOriginalVolume(s.originalVolume);
	}

	function onSfxLoaded(duration: number) {
		update((s) => {
			const instances: SfxInstance[] =
				s.sfxInstances.length > 0
					? [{ ...s.sfxInstances[0], endTime: s.sfxInstances[0].startTime + duration }]
					: [{ id: makeId(), startTime: 0, endTime: duration }];
			return { ...s, sfxAudioDuration: duration, sfxInstances: instances };
		});
		// Register in media bin + timeline (replace if re-generating)
		const s = get({ subscribe });
		if (s.sfxSessionId) {
			const existing = timelineStore.findBySession(s.sfxSessionId);
			if (existing) {
				timelineStore.syncSfxClips(existing.id, s.sfxInstances, existing.assetId);
			} else {
				const name = s.sfxFileName || 'SFX';
				const assetId = mediaBinStore.addAsset({
					type: 'sfx',
					name,
					sessionId: s.sfxSessionId,
					previewUrl: s.sfxPreviewUrl,
					duration
				});
				timelineStore.addSfxTrack(assetId, name, s.sfxSessionId, s.sfxInstances);
			}
			const sfxPrompt = s.sfxPrompt ?? '';
			const sfxTitle  = `SFX: ${sfxPrompt.slice(0, 40) || 'Generated SFX'}`;
			if (s.sfxPreviewUrl) saveAudioToLibrary(s.sfxPreviewUrl, sfxTitle, sfxPrompt, duration);
		}
	}

	return {
		subscribe,

		connectVideo: (videoElement: HTMLVideoElement) => {
			audioMixer.connectVideo(videoElement);
			syncOriginalToMixer();
		},

		// ── Original audio ───────────────────────────────────────────────────
		setOriginalVolume: (volume: number) => {
			update((s) => ({ ...s, originalVolume: volume }));
			syncOriginalToMixer();
		},

		setMusicDuration: (v: number) => update((s) => ({ ...s, musicDuration: v })),

		setOriginalFadeIn: (v: number) => {
			update((s) => ({ ...s, originalFadeIn: v }));
			audioMixer.setOriginalFadeIn(v);
		},
		setOriginalFadeOut: (v: number) => {
			update((s) => ({ ...s, originalFadeOut: v }));
			audioMixer.setOriginalFadeOut(v);
		},
		setVideoFadeIn: (v: number) => update((s) => ({ ...s, videoFadeIn: v })),
		setVideoFadeOut: (v: number) => update((s) => ({ ...s, videoFadeOut: v })),

		setOriginalMuted: (muted: boolean) => {
			update((s) => ({ ...s, originalMuted: muted }));
			syncOriginalToMixer();
		},

		// ── SFX ──────────────────────────────────────────────────────────────
		setSfxPrompt: (prompt: string) => update((s) => ({ ...s, sfxPrompt: prompt })),

		setSfxVolume: (volume: number) => {
			update((s) => ({ ...s, sfxVolume: volume }));
			audioMixer.setSfxVolume(volume);
		},

		setSfxLoop: (loop: boolean) => {
			update((s) => ({ ...s, sfxLoop: loop }));
			audioMixer.setSfxLoop(loop);
		},

		setSfxFadeIn: (v: number) => {
			update((s) => ({ ...s, sfxFadeIn: v }));
			audioMixer.setSfxFadeIn(v);
		},

		setSfxFadeOut: (v: number) => {
			update((s) => ({ ...s, sfxFadeOut: v }));
			audioMixer.setSfxFadeOut(v);
		},

		setSfxSuppressOriginal: (suppress: boolean) => {
			update((s) => ({ ...s, sfxSuppressOriginal: suppress }));
			syncOriginalToMixer();
		},

		// ── SFX instances ────────────────────────────────────────────────────
		updateSfxInstance: (id: string, startTime: number, endTime: number) => {
			update((s) => ({
				...s,
				sfxInstances: s.sfxInstances.map((inst) =>
					inst.id === id ? { ...inst, startTime, endTime } : inst
				)
			}));
		},

		duplicateSfxInstance: (id: string) => {
			update((s) => {
				const src = s.sfxInstances.find((i) => i.id === id);
				if (!src) return s;
				const duration = src.endTime - src.startTime;
				const newStart = src.endTime + 0.5;
				const newInst: SfxInstance = { id: makeId(), startTime: newStart, endTime: newStart + duration };
				return { ...s, sfxInstances: [...s.sfxInstances, newInst] };
			});
		},

		removeSfxInstance: (id: string) => {
			update((s) => ({
				...s,
				sfxInstances: s.sfxInstances.filter((i) => i.id !== id)
			}));
		},

		setLocalSfxFile: (fileName: string, objectUrl: string, sessionId: string) => {
			update((s) => ({
				...s,
				sfxSessionId: sessionId,
				sfxPreviewUrl: objectUrl,
				sfxFileName: fileName,
				sfxGenerating: false,
				sfxError: null,
				sfxInstances: [] // cleared — onSfxLoaded will set after buffer decodes
			}));
			audioMixer.loadSfx(objectUrl, onSfxLoaded);
		},

		setSfxResult: (sessionId: string, previewUrl: string) => {
			update((s) => ({
				...s,
				sfxSessionId: sessionId,
				sfxPreviewUrl: previewUrl,
				sfxGenerating: false,
				sfxError: null,
				sfxInstances: []
			}));
			audioMixer.loadSfx(previewUrl, onSfxLoaded);
		},

		setSfxGenerating: (val: boolean) =>
			update((s) => ({ ...s, sfxGenerating: val, sfxError: null })),

		setSfxError: (err: string) => update((s) => ({ ...s, sfxError: err, sfxGenerating: false })),

		stopSfx: () => {
			const { sfxSessionId } = get({ subscribe });
			audioMixer.stopSfx();
			update((s) => ({
				...s,
				sfxSessionId: null,
				sfxPreviewUrl: null,
				sfxFileName: null,
				sfxGenerating: false,
				sfxInstances: [],
				sfxAudioDuration: 0
			}));
			if (sfxSessionId) {
				const track = timelineStore.findBySession(sfxSessionId);
				if (track) timelineStore.removeTrack(track.id);
			}
			syncOriginalToMixer();
		},

		downloadSfx: () => {
			const state = get({ subscribe });
			if (!state.sfxPreviewUrl) return;
			const a = document.createElement('a');
			a.href = state.sfxPreviewUrl;
			a.download = `sfx-${Date.now()}.mp3`;
			document.body.appendChild(a);
			a.click();
			a.remove();
		},

		regenerateSfx: (generateFn: () => Promise<void>) => {
			audioMixer.stopSfx();
			update((s) => ({ ...s, sfxSessionId: null, sfxPreviewUrl: null, sfxInstances: [] }));
			generateFn();
		},

		syncSfxToVideo: (videoTime: number, isPlaying: boolean) => {
			const s = get({ subscribe });
			const sfxTrack = s.sfxSessionId ? timelineStore.findBySession(s.sfxSessionId) : null;
			const effectivePlaying = isPlaying && !(sfxTrack?.muted ?? false);
			audioMixer.syncSfxToVideo(videoTime, effectivePlaying, s.sfxInstances);
		},

		// ── MUSIC ────────────────────────────────────────────────────────────
		setMusicPrompt: (prompt: string) => update((s) => ({ ...s, musicPrompt: prompt })),

		setActiveMusicSession: (sessionId: string | null) => {
			update((s) => {
				if (!sessionId) return { ...s, activeMusicSessionId: null };
				const e = s.musicEntries[sessionId];
				if (!e) return { ...s, activeMusicSessionId: sessionId };
				return {
					...s,
					activeMusicSessionId: sessionId,
					// Snap flat panel fields to this entry's values
					musicVolume:    e.volume,
					musicStartTime: e.startTime,
					musicEndTime:   e.endTime,
					musicTrimStart: e.trimStart,
					musicFadeIn:    e.fadeIn,
					musicFadeOut:   e.fadeOut,
					musicSessionId: sessionId
				};
			});
		},

		setMusicVolume: (volume: number) => {
			update((s) => ({ ...s, musicVolume: volume }));
			patchActiveEntry({ volume });
			audioMixer.setMusicVolume(volume);
		},

		setMusicStartTime: (v: number) => {
			update((s) => ({ ...s, musicStartTime: v }));
			patchActiveEntry({ startTime: v });
		},

		setMusicEndTime: (v: number) => {
			update((s) => ({ ...s, musicEndTime: v }));
			patchActiveEntry({ endTime: v });
		},

		setMusicTrimStart: (v: number) => {
			update((s) => ({ ...s, musicTrimStart: v }));
			patchActiveEntry({ trimStart: v });
		},

		setMusicFadeIn: (v: number) => {
			update((s) => ({ ...s, musicFadeIn: v }));
			patchActiveEntry({ fadeIn: v });
			const sid = get({ subscribe }).activeMusicSessionId;
			if (sid) audioMixer.setMusicFadeIn(sid);
		},

		setMusicFadeOut: (v: number) => {
			update((s) => ({ ...s, musicFadeOut: v }));
			patchActiveEntry({ fadeOut: v });
			const sid = get({ subscribe }).activeMusicSessionId;
			if (sid) audioMixer.setMusicFadeOut(sid);
		},

		setMusicSuppressOriginal: (suppress: boolean) => {
			update((s) => ({ ...s, musicSuppressOriginal: suppress }));
			syncOriginalToMixer();
		},

		setLocalMusicFile: (fileName: string, objectUrl: string, sessionId: string) => {
			update((s) => ({
				...s,
				musicSessionId: sessionId,
				musicPreviewUrl: objectUrl,
				musicFileName: fileName,
				musicGenerating: false,
				musicError: null,
				musicTrimStart: 0
			}));
			audioMixer.loadMusic(sessionId, objectUrl, (durationSeconds) => {
				const s = get({ subscribe });
				const startTime = 0;
				const endTime   = startTime + durationSeconds;
				const name      = fileName || 'Music';
				const entry: MusicEntry = {
					sessionId, previewUrl: objectUrl, fileName, generating: false, error: null, prompt: '',
					volume: 0.3, startTime, endTime, trimStart: 0, fadeIn: 0, fadeOut: 0
				};
				update((st) => ({
					...st,
					musicEndTime: endTime,
					musicFadeIn: 0, musicFadeOut: 0, musicTrimStart: 0,
					musicStartTime: startTime, musicVolume: 0.3,
					activeMusicSessionId: sessionId,
					musicEntries: { ...st.musicEntries, [sessionId]: entry }
				}));
				const existing = timelineStore.findBySession(sessionId);
				if (existing) {
					timelineStore.updateClip(existing.id, existing.clips[0]?.id ?? '', { endTime });
				} else {
					const assetId = mediaBinStore.addAsset({ type: 'music', name, sessionId, previewUrl: objectUrl, duration: durationSeconds });
					timelineStore.addMusicTrack(assetId, name, sessionId, startTime, endTime);
				}
			});
		},

		setMusicResult: (sessionId: string, previewUrl: string) => {
			update((s) => ({
				...s,
				musicSessionId: sessionId,
				musicPreviewUrl: previewUrl,
				musicGenerating: false,
				musicError: null,
				musicTrimStart: 0
			}));
			audioMixer.loadMusic(sessionId, previewUrl, (durationSeconds) => {
				const s    = get({ subscribe });
				const startTime = 0;
				const endTime   = startTime + durationSeconds;
				const name      = s.musicPrompt ? `Music: ${s.musicPrompt.slice(0, 30)}` : 'Generated Music';
				const entry: MusicEntry = {
					sessionId, previewUrl, fileName: null, generating: false, error: null, prompt: s.musicPrompt,
					volume: 0.3, startTime, endTime, trimStart: 0, fadeIn: 0, fadeOut: 0
				};
				update((st) => ({
					...st,
					musicEndTime: endTime,
					musicFadeIn: 0, musicFadeOut: 0, musicTrimStart: 0,
					musicStartTime: startTime, musicVolume: 0.3,
					activeMusicSessionId: sessionId,
					musicEntries: { ...st.musicEntries, [sessionId]: entry }
				}));
				const existing = timelineStore.findBySession(sessionId);
				if (existing) {
					timelineStore.updateClip(existing.id, existing.clips[0]?.id ?? '', { endTime });
				} else {
					const assetId = mediaBinStore.addAsset({ type: 'music', name, sessionId, previewUrl, duration: durationSeconds });
					timelineStore.addMusicTrack(assetId, name, sessionId, startTime, endTime);
				}
				saveAudioToLibrary(previewUrl, name, s.musicPrompt, durationSeconds);
			});
		},

		setMusicGenerating: (val: boolean) =>
			update((s) => ({ ...s, musicGenerating: val, musicError: null })),

		setMusicError: (err: string) =>
			update((s) => ({ ...s, musicError: err, musicGenerating: false })),

		stopMusic: (sessionId?: string) => {
			if (sessionId) {
				audioMixer.stopMusic(sessionId);
				update((s) => {
					const entries = { ...s.musicEntries };
					delete entries[sessionId];
					return { ...s, musicEntries: entries, musicSessionId: s.musicSessionId === sessionId ? null : s.musicSessionId };
				});
				const track = timelineStore.findBySession(sessionId);
				if (track) timelineStore.removeTrack(track.id);
			} else {
				const { musicSessionId } = get({ subscribe });
				audioMixer.stopMusic();
				update((s) => ({
					...s, musicEntries: {},
					musicSessionId: null, musicPreviewUrl: null, musicFileName: null, musicGenerating: false
				}));
				if (musicSessionId) {
					const track = timelineStore.findBySession(musicSessionId);
					if (track) timelineStore.removeTrack(track.id);
				}
			}
			syncOriginalToMixer();
		},

		downloadMusic: () => {
			const state = get({ subscribe });
			if (!state.musicPreviewUrl) return;
			const a = document.createElement('a');
			a.href = state.musicPreviewUrl;
			a.download = `music-${Date.now()}.mp3`;
			document.body.appendChild(a);
			a.click();
			a.remove();
		},

		regenerateMusic: (generateFn: () => Promise<void>) => {
			const { musicSessionId } = get({ subscribe });
			if (musicSessionId) audioMixer.stopMusic(musicSessionId);
			update((s) => ({ ...s, musicSessionId: null, musicPreviewUrl: null }));
			generateFn();
		},

		syncOriginalFadeToVideo: (videoTime: number, duration: number) => {
			audioMixer.syncOriginalFadeToVideo(videoTime, duration);
		},

		syncMusicToVideo: (videoTime: number, isPlaying: boolean) => {
			const s = get({ subscribe });
			const trackStates: MusicTrackState[] = Object.values(s.musicEntries).map((e) => {
				const timelineTrack = timelineStore.findBySession(e.sessionId);
				const muted  = timelineTrack?.muted ?? false;
				const clips: MusicClipState[] = (timelineTrack?.clips ?? []).map(c => ({
					id: c.id,
					startTime:   c.startTime,
					endTime:     c.endTime,
					sourceStart: c.sourceStart,
					sourceEnd:   c.sourceEnd
				}));
				return {
					sessionId: e.sessionId,
					volume:    muted ? 0 : e.volume,
					fadeIn:    e.fadeIn,
					fadeOut:   e.fadeOut,
					clips
				};
			});
			audioMixer.syncMusicToVideo(videoTime, isPlaying, trackStates);
		},

		updateMusicEntry: (sessionId: string, patch: Partial<MusicEntry>) => {
			update((s) => {
				const existing = s.musicEntries[sessionId];
				if (!existing) return s;
				return { ...s, musicEntries: { ...s.musicEntries, [sessionId]: { ...existing, ...patch } } };
			});
		},

		stopAll: () => { audioMixer.stopAll(); },

		reset: () => {
			audioMixer.destroy();
			set(initialState);
		}
	};
}

export const audioStudioStore = createAudioStudioStore();
