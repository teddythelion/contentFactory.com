import { redirect } from '@sveltejs/kit';
import { isUserAdmin } from '$lib/server/adminAuth';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const uid = locals.user?.uid;
	if (!uid || !(await isUserAdmin(uid))) {
		redirect(303, '/');
	}
	return {};
};
