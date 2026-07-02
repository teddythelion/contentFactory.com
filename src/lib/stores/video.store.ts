// src/lib/stores/video.store.ts
// FIXED: Don't persist large video data URLs to localStorage
// UPDATED: Added currentTime and isPlaying as single source of truth

import { writable } from 'svelte/store';

interface VideoState {
	videoUrl: string | null;
	processedVideoUrl: string | null;
	threeDVideoUrl: string | null; // Legacy - no longer used but kept for compatibility
	isVideoLoaded: boolean;
	isProcessing: boolean;
	videoError: string | null;
	videoDuration: number;
	videoWidth: number;
	videoHeight: number;
	currentTime: number; // Single source of truth for playback position
	isPlaying: boolean; // Single source of truth for play/pause state
	inVideoGap: boolean; // true when playhead is between clips (show black screen)
}

const initialState: VideoState = {
	videoUrl: null,
	processedVideoUrl: null,
	threeDVideoUrl: null, // Legacy - no longer used
	isVideoLoaded: false,
	isProcessing: false,
	videoError: null,
	videoDuration: 0,
	videoWidth: 0,
	videoHeight: 0,
	currentTime: 0,
	isPlaying: false,
	inVideoGap: false
};

function createVideoStore() {
	const { subscribe, set, update } = writable<VideoState>(initialState);

	return {
		subscribe,
		set,

		setVideo: (url: string) => {
			update((state) => ({
				...state,
				videoUrl: url,
				isVideoLoaded: true,
				videoError: null
			}));
		},

		setProcessedVideo: (url: string) => {
			update((state) => ({
				...state,
				processedVideoUrl: url
			}));
		},

		setProcessing: (isProcessing: boolean) => {
			update((state) => ({ ...state, isProcessing }));
		},

		setError: (error: string) => {
			update((state) => ({
				...state,
				videoError: error,
				isProcessing: false
			}));
		},

		clearError: () => {
			update((state) => ({ ...state, videoError: null }));
		},

		setVideoDimensions: (width: number, height: number, duration: number) => {
			update((state) => ({
				...state,
				videoWidth: width,
				videoHeight: height,
				videoDuration: duration
			}));
		},

		// NEW: Update current playback time (called by video element)
		setCurrentTime: (time: number) => {
			update((state) => ({ ...state, currentTime: time }));
		},

		// NEW: Update play/pause state (called by video element)
		setIsPlaying: (playing: boolean) => {
			update((state) => ({ ...state, isPlaying: playing }));
		},

		setInVideoGap: (inVideoGap: boolean) => {
			update((state) => ({ ...state, inVideoGap }));
		},

		clearVideo: () => {
			set(initialState);
		},

		reset: () => {
			set(initialState);
		}
	};
}

export const videoState = createVideoStore();

// IMPORTANT: Do NOT use localStorage persistence for video store
// Video data URLs are too large (can be 5-50MB) and will exceed quota
// Videos should be handled in-memory only or downloaded directly to disk
