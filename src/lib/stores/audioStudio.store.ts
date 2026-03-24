// src/lib/stores/audioStudio.store.ts
// All state changes flow through to audioMixer in real time.
// The mixer handles Web Audio API — what you hear = what gets exported.

import { writable, get } from 'svelte/store';
import { audioMixer } from '$lib/utils/audioMixer.ts';

interface AudioStudioState {
	originalVolume: number;
	originalMuted: boolean;
	musicDuration: number;
	sfxPrompt: string;
	sfxSessionId: string | null;
	sfxPreviewUrl: string | null;
	sfxVolume: number;
	sfxLoop: boolean;
	sfxGenerating: boolean;
	sfxError: string | null;
	sfxStartTime: number;
	sfxEndTime: number;
	sfxFadeIn: number;
	sfxFadeOut: number;
	sfxSuppressOriginal: boolean;

	musicPrompt: string;
	musicSessionId: string | null;
	musicPreviewUrl: string | null;
	musicVolume: number;
	musicGenerating: boolean;
	musicError: string | null;
	musicStartTime: number;
	musicEndTime: number;
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
	sfxVolume: 0.4,
	sfxLoop: false,
	sfxGenerating: false,
	sfxError: null,
	sfxStartTime: 0,
	sfxEndTime: 8,
	sfxFadeIn: 0,
	sfxFadeOut: 0,
	sfxSuppressOriginal: false,

	musicPrompt: '',
	musicSessionId: null,
	musicPreviewUrl: null,
	musicVolume: 0.3,
	musicGenerating: false,
	musicError: null,
	musicStartTime: 0,
	musicEndTime: 8,
	musicFadeIn: 0,
	musicFadeOut: 0,
	musicSuppressOriginal: false
};

function createAudioStudioStore() {
	const { subscribe, set, update } = writable<AudioStudioState>(initialState);

	// Derive effective mute state — muted if explicitly muted OR
	// if either SFX or music has suppressOriginal enabled
	function syncOriginalToMixer() {
		const s = get({ subscribe });
		const effectivelyMuted = s.originalMuted || s.sfxSuppressOriginal || s.musicSuppressOriginal;
		audioMixer.setOriginalMuted(effectivelyMuted);
		audioMixer.setOriginalVolume(s.originalVolume);
	}

	return {
		subscribe,

		// ── Connect video element to mixer (call once on scene ready) ────────
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

		setSfxStartTime: (v: number) => {
			update((s) => ({ ...s, sfxStartTime: v }));
			audioMixer.setSfxStartTime(v);
		},

		setSfxEndTime: (v: number) => {
			update((s) => ({ ...s, sfxEndTime: v }));
			audioMixer.setSfxEndTime(v);
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

		setSfxResult: (sessionId: string, previewUrl: string) => {
			update((s) => ({
				...s,
				sfxSessionId: sessionId,
				sfxPreviewUrl: previewUrl,
				sfxGenerating: false,
				sfxError: null
			}));
			// Load into mixer — plays immediately with correct volume/fades
			audioMixer.loadSfx(previewUrl);
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
				sfxGenerating: false
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
			update((s) => ({ ...s, sfxSessionId: null, sfxPreviewUrl: null }));
			generateFn();
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

		setMusicResult: (sessionId: string, previewUrl: string) => {
			update((s) => ({
				...s,
				musicSessionId: sessionId,
				musicPreviewUrl: previewUrl,
				musicGenerating: false,
				musicError: null
			}));
			audioMixer.loadMusic(previewUrl);
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

		stopAll: () => {
			audioMixer.stopAll();
		},

		reset: () => {
			audioMixer.destroy();
			set(initialState);
		}
	};
}

export const audioStudioStore = createAudioStudioStore();
