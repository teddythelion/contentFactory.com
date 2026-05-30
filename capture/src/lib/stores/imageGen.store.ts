// src/lib/stores/imageGen.store.ts
// Image Generation State Management - NO BASE64 IN LOCALSTORAGE
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export interface ImageGenState {
	// Current generation
	imageUrl: string | null;
	imageBase64: string | null; // ← In memory only (for current download)
	prompt: string;

	// Generation metadata
	generatedAt: number | null;
	model: string;

	// UI state
	loading: boolean;
	status: string;
	error: string | null;

	// History - lightweight (URLs only, no base64)
	history: Array<{
		imageUrl: string;
		prompt: string;
		generatedAt: number;
		model: string;
	}>;
}

const STORAGE_KEY = 'imageGen_state';
const MAX_HISTORY = 10;

// Load initial state from localStorage
function loadInitialState(): ImageGenState {
	if (browser) {
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved) {
				const parsed = JSON.parse(saved);
				return {
					...getDefaultState(),
					...parsed,
					loading: false,
					status: '',
					error: null,
					imageBase64: null // ← Never load base64 from localStorage
				};
			}
		} catch (e) {
			console.error('Failed to load imageGen state:', e);
		}
	}
	return getDefaultState();
}

function getDefaultState(): ImageGenState {
	return {
		imageUrl: null,
		imageBase64: null,
		prompt: '',
		generatedAt: null,
		model: 'gpt-image-1.5',
		loading: false,
		status: '',
		error: null,
		history: []
	};
}

function createImageGenStore() {
	const { subscribe, set, update } = writable<ImageGenState>(loadInitialState());

	// Persist to localStorage - NO BASE64!
	function persist(state: ImageGenState) {
		if (browser) {
			try {
				const toPersist = {
					imageUrl: state.imageUrl,
					prompt: state.prompt,
					generatedAt: state.generatedAt,
					model: state.model,
					history: state.history.map((item) => ({
						imageUrl: item.imageUrl,
						prompt: item.prompt,
						generatedAt: item.generatedAt,
						model: item.model
					}))
				};
				localStorage.setItem(STORAGE_KEY, JSON.stringify(toPersist));
			} catch (e) {
				console.error('Failed to persist imageGen state:', e);
			}
		}
	}

	return {
		subscribe,

		// Set prompt
		setPrompt: (prompt: string) =>
			update((state) => {
				const newState = { ...state, prompt };
				persist(newState);
				return newState;
			}),

		// Start generation
		startGeneration: () =>
			update((state) => ({
				...state,
				loading: true,
				status: 'Generating image...',
				error: null
			})),

		// Generation succeeded
		setGeneratedImage: (imageUrl: string, imageBase64: string | null, prompt: string) =>
			update((state) => {
				const generatedAt = Date.now();

				const historyItem = {
					imageUrl,
					prompt,
					generatedAt,
					model: state.model
				};

				const newHistory = [historyItem, ...state.history].slice(0, MAX_HISTORY);

				const newState = {
					...state,
					imageUrl,
					imageBase64, // ← In memory only
					prompt,
					generatedAt,
					loading: false,
					status: '✅ Image created! Ready to download or save.',
					error: null,
					history: newHistory
				};

				persist(newState);
				return newState;
			}),

		// Generation failed
		setError: (error: string) =>
			update((state) => ({
				...state,
				loading: false,
				status: '',
				error
			})),

		// Update status
		setStatus: (status: string) =>
			update((state) => ({
				...state,
				status
			})),

		// Clear current (keep history)
		clearCurrent: () =>
			update((state) => {
				const newState = {
					...state,
					imageUrl: null,
					imageBase64: null,
					prompt: '',
					generatedAt: null,
					loading: false,
					status: '',
					error: null
				};
				persist(newState);
				return newState;
			}),

		// Clear everything
		clearAll: () => {
			const newState = getDefaultState();
			if (browser) {
				localStorage.removeItem(STORAGE_KEY);
			}
			set(newState);
		},

		// Load from history
		loadFromHistory: (index: number) =>
			update((state) => {
				if (index >= 0 && index < state.history.length) {
					const item = state.history[index];
					const newState = {
						...state,
						imageUrl: item.imageUrl,
						imageBase64: null, // ← No base64 from history
						prompt: item.prompt,
						generatedAt: item.generatedAt,
						model: item.model,
						status: '📜 Loaded from history'
					};
					persist(newState);
					return newState;
				}
				return state;
			}),

		// Remove from history
		removeFromHistory: (index: number) =>
			update((state) => {
				const newHistory = state.history.filter((_, i) => i !== index);
				const newState = { ...state, history: newHistory };
				persist(newState);
				return newState;
			}),

		// Get current image for download
		getCurrentImage: (state: ImageGenState): string | null => {
			return (
				state.imageUrl || (state.imageBase64 ? `data:image/png;base64,${state.imageBase64}` : null)
			);
		},

		// Check if we have an image
		hasImage: (state: ImageGenState): boolean => {
			return !!(state.imageUrl || state.imageBase64);
		}
	};
}

export const imageGenStore = createImageGenStore();

// Helper function to format timestamp
export function formatTimestamp(timestamp: number): string {
	const now = Date.now();
	const diff = now - timestamp;

	const minutes = Math.floor(diff / 60000);
	const hours = Math.floor(diff / 3600000);
	const days = Math.floor(diff / 86400000);

	if (minutes < 1) return 'Just now';
	if (minutes < 60) return `${minutes}m ago`;
	if (hours < 24) return `${hours}h ago`;
	return `${days}d ago`;
}
