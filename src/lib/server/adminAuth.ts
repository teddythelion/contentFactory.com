// src/lib/server/adminAuth.ts
// Session-based admin gate — checks the Firestore isAdmin flag for the
// logged-in user. Used by /admin routes and /api/admin/* endpoints.

import { error } from '@sveltejs/kit';
import { adminDb } from '$lib/firebase/admin';

export async function isUserAdmin(uid: string | null | undefined): Promise<boolean> {
	if (!uid) return false;
	const doc = await adminDb.collection('users').doc(uid).get();
	return doc.data()?.isAdmin === true;
}

export async function requireAdmin(uid: string | null | undefined): Promise<void> {
	if (!uid) error(401, 'Unauthorized');
	if (!(await isUserAdmin(uid))) error(403, 'Admin access required');
}
