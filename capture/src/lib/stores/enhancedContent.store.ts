// src/lib/stores/enhancedContent.store.ts
import { writable } from 'svelte/store';

interface EnhancedContentState {
	contentId: string | null;
	contentUrl: string | null;
	contentType: 'video' | 'image';
	isSaving: boolean;
	saveStatus: string;
	saveError: string | null;
}

const initialState: EnhancedContentState = {
	contentId: null,
	contentUrl: null,
	contentType: 'video',
	isSaving: false,
	saveStatus: '',
	saveError: null
};

function createEnhancedContentStore() {
	const { subscribe, set, update } = writable<EnhancedContentState>(initialState);

	return {
		subscribe,
		set,

		startSaving: () => {
			update((state) => ({
				...state,
				isSaving: true,
				saveStatus: 'Saving enhanced content...',
				saveError: null
			}));
		},

		setSavedContent: (contentId: string, contentUrl: string, contentType: 'video' | 'image') => {
			update((state) => ({
				...state,
				contentId,
				contentUrl,
				contentType,
				isSaving: false,
				saveStatus: '✅ Content saved! Ready to post.',
				saveError: null
			}));
		},

		setSaveError: (error: string) => {
			update((state) => ({
				...state,
				isSaving: false,
				saveStatus: '',
				saveError: error
			}));
		},

		clearStatus: () => {
			update((state) => ({
				...state,
				saveStatus: '',
				saveError: null
			}));
		},

		reset: () => {
			set(initialState);
		}
	};
}

export const enhancedContentState = createEnhancedContentStore();