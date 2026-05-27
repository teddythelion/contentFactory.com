// src/lib/stores/audioStudio.store.ts
// All state changes flow through to audioMixer in real time.
// The mixer handles Web Audio API — what you hear = what gets exported.

import { writable, get } from 'svelte/store';
import { audioMixer } from '$lib/utils/audioMixer.ts';

export interface SfxInstance {
	id: string;
	startTime: number;
	endTime: number;
}

interface AudioStudioState {
	originalVolume: number;
	originalMuted: boolean;
	musicDuration: number;
	sfxPrompt: string;
	sfxSessionId: string | null;
	sfxPreviewUrl: string | null;
	sfxFileName: string | null;
	sfxVolume: number;
	sfxLoop: boolean;
	sfxGenerating: boolean;
	sfxError: string | null;
	sfxAudioDuration: number; // actual decoded buffer duration
	sfxInstances: SfxInstance[];
	sfxFadeIn: number;
	sfxFadeOut: number;
	sfxSuppressOriginal: boolean;

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
	musicDuration: 30,
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
			audioMixer.syncSfxToVideo(videoTime, isPlaying, s.sfxInstances);
		},

		// ── MUSIC ────────────────────────────────────────────────────────────
		setMusicPrompt: (prompt: string) => update((s) => ({ ...s, musicPrompt: prompt })),

		setMusicVolume: (volume: number) => {
			update((s) => ({ ...s, musicVolume: volume }));
			audioMixer.setMusicVolume(volume);
		},

		setMusicStartTime: (v: number) => {
			update((s) => ({ ...s, musicStartTime: v }));
			audioMixer.setMusicStartTime(v);
		},

		setMusicEndTime: (v: number) => {
			update((s) => ({ ...s, musicEndTime: v }));
			audioMixer.setMusicEndTime(v);
		},

		setMusicTrimStart: (v: number) => {
			update((s) => ({ ...s, musicTrimStart: v }));
			audioMixer.setMusicTrimStart(v);
		},

		setMusicFadeIn: (v: number) => {
			update((s) => ({ ...s, musicFadeIn: v }));
			audioMixer.setMusicFadeIn(v);
		},

		setMusicFadeOut: (v: number) => {
			update((s) => ({ ...s, musicFadeOut: v }));
			audioMixer.setMusicFadeOut(v);
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
			audioMixer.loadMusic(objectUrl, (durationSeconds) => {
				const currentStart = get({ subscribe }).musicStartTime;
				const newEnd = currentStart + durationSeconds;
				update((s) => ({ ...s, musicEndTime: newEnd }));
				audioMixer.setMusicEndTime(newEnd);
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
			audioMixer.loadMusic(previewUrl, (durationSeconds) => {
				const currentStart = get({ subscribe }).musicStartTime;
				const newEnd = currentStart + durationSeconds;
				update((s) => ({ ...s, musicEndTime: newEnd }));
				audioMixer.setMusicEndTime(newEnd);
			});
		},

		setMusicGenerating: (val: boolean) =>
			update((s) => ({ ...s, musicGenerating: val, musicError: null })),

		setMusicError: (err: string) =>
			update((s) => ({ ...s, musicError: err, musicGenerating: false })),

		stopMusic: () => {
			audioMixer.stopMusic();
			update((s) => ({
				...s,
				musicSessionId: null,
				musicPreviewUrl: null,
				musicFileName: null,
				musicGenerating: false
			}));
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
			audioMixer.stopMusic();
			update((s) => ({ ...s, musicSessionId: null, musicPreviewUrl: null }));
			generateFn();
		},

		syncMusicToVideo: (videoTime: number, isPlaying: boolean) => {
			audioMixer.syncMusicToVideo(videoTime, isPlaying);
		},

		stopAll: () => { audioMixer.stopAll(); },

		reset: () => {
			audioMixer.destroy();
			set(initialState);
		}
	};
}

export const audioStudioStore = createAudioStudioStore();
