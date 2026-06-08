import { writable } from 'svelte/store';
import { auth } from '$lib/firebase/client';
import {
	signInWithPopup,
	signOut as firebaseSignOut,
	GoogleAuthProvider,
	onAuthStateChanged,
	createUserWithEmailAndPassword,
	signInWithEmailAndPassword,
	sendPasswordResetEmail,
	updateProfile,
	type User as FirebaseUser
} from 'firebase/auth';
import type { User, AuthState } from '$lib/types/user';
import { createUserProfile, getUserProfile, updateLastLogin } from '$lib/firebase/firestore';

// Helper to convert Firebase User to our User type
function mapFirebaseUser(firebaseUser: FirebaseUser | null): User | null {
	if (!firebaseUser) return null;

	return {
		uid: firebaseUser.uid,
		email: firebaseUser.email,
		displayName: firebaseUser.displayName,
		photoURL: firebaseUser.photoURL,
		emailVerified: firebaseUser.emailVerified
	};
}

function friendlyAuthError(code: string): string {
	const map: Record<string, string> = {
		'auth/email-already-in-use': 'An account with this email already exists.',
		'auth/invalid-email': 'Please enter a valid email address.',
		'auth/weak-password': 'Password must be at least 6 characters.',
		'auth/user-not-found': 'No account found with this email.',
		'auth/wrong-password': 'Incorrect password.',
		'auth/invalid-credential': 'Incorrect email or password.',
		'auth/too-many-requests': 'Too many attempts. Please try again later.'
	};
	return map[code] || '';
}

// Create the store
function createAuthStore() {
	const { subscribe, set, update } = writable<AuthState>({
		user: null,
		loading: true,
		error: null,
		initialized: false
	});

	// Initialize auth state listener (runs once on app load)
	if (typeof window !== 'undefined') {
		onAuthStateChanged(auth, async (firebaseUser) => {
			if (firebaseUser) {
				// Force token refresh before hitting Firestore so auth is valid
				await firebaseUser.getIdToken(false);
				// Check if user profile exists in Firestore
				const userProfile = await getUserProfile(firebaseUser.uid);

				if (!userProfile) {
					// First time sign in - create profile
					await createUserProfile(
						firebaseUser.uid,
						firebaseUser.email || '',
						firebaseUser.displayName,
						firebaseUser.photoURL
					);
				} else {
					// Update last login
					await updateLastLogin(firebaseUser.uid);
				}
			}

			set({
				user: mapFirebaseUser(firebaseUser),
				loading: false,
				error: null,
				initialized: true
			});
		});
	}

	return {
		subscribe,

		// Sign in with Google
		signInWithGoogle: async () => {
			try {
				update((state) => ({ ...state, loading: true, error: null }));
				const provider = new GoogleAuthProvider();
				provider.setCustomParameters({
					prompt: 'select_account' // ← Force account picker
				});
				const result = await signInWithPopup(auth, provider);

				console.log('🔍 Google sign in successful, creating session...');
				const idToken = await result.user.getIdToken();
				console.log('🔍 Got idToken, calling session endpoint...');

				const sessionResponse = await fetch('/api/auth/session', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ idToken })
				});

				console.log('🔍 Session response:', sessionResponse.status);
				if (!sessionResponse.ok) {
					throw new Error('Failed to create session');
				}

				// Check if user profile exists
				const userProfile = await getUserProfile(result.user.uid);

				if (!userProfile) {
					// Create profile for new user
					await createUserProfile(
						result.user.uid,
						result.user.email || '',
						result.user.displayName,
						result.user.photoURL
					);
				}

				update((state) => ({
					...state,
					user: mapFirebaseUser(result.user),
					loading: false,
					error: null,
					initialized: true
				}));

				return { success: true, user: result.user };
			} catch (error: any) {
				const errorMessage = error.message || 'Failed to sign in';
				update((state) => ({
					...state,
					loading: false,
					error: errorMessage
				}));
				return { success: false, error: errorMessage };
			}
		},

		// Sign up with email/password
		signUpWithEmail: async (email: string, password: string, displayName: string) => {
			try {
				update((state) => ({ ...state, loading: true, error: null }));
				const result = await createUserWithEmailAndPassword(auth, email, password);

				if (displayName) {
					await updateProfile(result.user, { displayName });
				}

				const idToken = await result.user.getIdToken();
				const sessionResponse = await fetch('/api/auth/session', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ idToken })
				});
				if (!sessionResponse.ok) throw new Error('Failed to create session');

				await createUserProfile(result.user.uid, email, displayName, null);

				update((state) => ({
					...state,
					user: mapFirebaseUser(result.user),
					loading: false,
					error: null,
					initialized: true
				}));

				return { success: true, user: result.user };
			} catch (error: any) {
				const errorMessage = friendlyAuthError(error.code) || error.message;
				update((state) => ({ ...state, loading: false, error: errorMessage }));
				return { success: false, error: errorMessage };
			}
		},

		// Sign in with email/password
		signInWithEmail: async (email: string, password: string) => {
			try {
				update((state) => ({ ...state, loading: true, error: null }));
				const result = await signInWithEmailAndPassword(auth, email, password);

				const idToken = await result.user.getIdToken();
				const sessionResponse = await fetch('/api/auth/session', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ idToken })
				});
				if (!sessionResponse.ok) throw new Error('Failed to create session');

				update((state) => ({
					...state,
					user: mapFirebaseUser(result.user),
					loading: false,
					error: null,
					initialized: true
				}));

				return { success: true, user: result.user };
			} catch (error: any) {
				const errorMessage = friendlyAuthError(error.code) || error.message;
				update((state) => ({ ...state, loading: false, error: errorMessage }));
				return { success: false, error: errorMessage };
			}
		},

		// Password reset
		resetPassword: async (email: string) => {
			try {
				await sendPasswordResetEmail(auth, email);
				return { success: true };
			} catch (error: any) {
				return { success: false, error: friendlyAuthError(error.code) || error.message };
			}
		},

		// Sign out
		signOut: async () => {
			try {
				update((state) => ({ ...state, loading: true, error: null }));
				await firebaseSignOut(auth);

				set({
					user: null,
					loading: false,
					error: null,
					initialized: true
				});

				return { success: true };
			} catch (error: any) {
				const errorMessage = error.message || 'Failed to sign out';
				update((state) => ({
					...state,
					loading: false,
					error: errorMessage
				}));
				return { success: false, error: errorMessage };
			}
		},

		// Update photo URL after profile image upload
		updatePhotoURL: (photoURL: string) => {
			update((state) => ({
				...state,
				user: state.user ? { ...state.user, photoURL } : state.user
			}));
		},

		// Clear error
		clearError: () => {
			update((state) => ({ ...state, error: null }));
		}
	};
}

export const authStore = createAuthStore();
