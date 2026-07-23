// Admin user list. The layout guard already verifies isAdmin before this
// runs — this repeats the check so the data load isn't solely dependent on
// the layout for isolation (defense in depth on the actual admin surface).
import { redirect } from '@sveltejs/kit';
import { adminDb } from '$lib/firebase/admin';
import { isUserAdmin } from '$lib/server/adminAuth';
import type { PageServerLoad } from './$types';

export interface AdminUserRow {
	uid: string;
	email: string;
	displayName: string | null;
	plan: string;
	isAdmin: boolean;
	storageUsed: number;
	storageLimit: number;
	imagesGenerated: number;
	videosGenerated: number;
	subscriptionStatus: string | null;
	createdAt: number | null;
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!(await isUserAdmin(locals.user?.uid))) {
		redirect(303, '/');
	}

	const snap = await adminDb.collection('users').orderBy('email').get();

	const users: AdminUserRow[] = snap.docs.map((doc) => {
		const d = doc.data();
		return {
			uid: doc.id,
			email: d.email ?? '(no email)',
			displayName: d.displayName ?? null,
			plan: d.plan ?? 'free',
			isAdmin: d.isAdmin === true,
			storageUsed: d.storageUsed ?? 0,
			storageLimit: d.storageLimit ?? 0,
			imagesGenerated: d.imagesGenerated ?? 0,
			videosGenerated: d.videosGenerated ?? 0,
			subscriptionStatus: d.subscriptionStatus ?? null,
			createdAt: d.createdAt?.toMillis?.() ?? null
		};
	});

	return { users };
};
