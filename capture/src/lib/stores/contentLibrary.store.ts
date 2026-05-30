import { writable, derived } from 'svelte/store';
import { adminDb } from '$lib/firebase/admin';
import type { Timestamp } from 'firebase-admin/firestore';

export interface ContentItem {
	contentId: string;
	userId: string;
	type: 'image' | 'video';
	title: string;
	prompt: string;
	publicUrl: string;
	gcsPath: string;
	createdAt: Timestamp;
	fileSize: number;
	format: string;
	model?: string;
}

interface ContentLibraryState {
	items: ContentItem[];
	loading: boolean;
	error: string | null;
	userId: string | null;
}

function createContentLibraryStore() {
	const { subscribe, set, update } = writable<ContentLibraryState>({
		items: [],
		loading: false,
		error: null,
		userId: null
	});

	return {
		subscribe,

		// Load user's content from Firestore
		loadContent: async (userId: string) => {
			update((state) => ({ ...state, loading: true, error: null, userId }));

			try {
				const response = await fetch(`/api/content/list?userId=${userId}`);
				const data = await response.json();

				if (!response.ok) {
					throw new Error(data.error || 'Failed to load content');
				}

				update((state) => ({
					...state,
					items: data.items || [],
					loading: false
				}));
			} catch (error: any) {
				update((state) => ({
					...state,
					error: error.message,
					loading: false
				}));
			}
		},

		// Delete item
		deleteItem: async (contentId: string) => {
			try {
				const response = await fetch(`/api/content/delete`, {
					method: 'DELETE',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ contentId })
				});

				if (!response.ok) {
					throw new Error('Failed to delete');
				}

				update((state) => ({
					...state,
					items: state.items.filter((item) => item.contentId !== contentId)
				}));
			} catch (error: any) {
				update((state) => ({
					...state,
					error: error.message
				}));
			}
		},

		// Clear all
		clear: () => {
			set({
				items: [],
				loading: false,
				error: null,
				userId: null
			});
		}
	};
}

export const contentLibraryStore = createContentLibraryStore();

// Derived stores for images and videos
export const imagesStore = derived(contentLibraryStore, ($lib) =>
	$lib.items.filter((item) => item.type === 'image')
);

export const videosStore = derived(contentLibraryStore, ($lib) =>
	$lib.items.filter((item) => item.type === 'video')
);
