// src/routes/api/admin/set-plan/+server.ts
// Internal admin endpoint — sets a user's plan directly in Firestore.
// Protected by ADMIN_SECRET env var; not exposed to clients.

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { adminDb } from '$lib/firebase/admin';
import { TIER_CONFIG, type PlanTier } from '$lib/types/subscription';

const VALID_PLANS = Object.keys(TIER_CONFIG) as PlanTier[];

export const POST: RequestHandler = async ({ request }) => {
	const secret = request.headers.get('x-admin-secret');
	if (!secret || secret !== env.ADMIN_SECRET) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body = await request.json().catch(() => null);
	const { userId, plan } = body ?? {};

	if (!userId || !plan) {
		return json({ error: 'Missing userId or plan' }, { status: 400 });
	}

	if (!VALID_PLANS.includes(plan)) {
		return json({ error: `Invalid plan. Must be one of: ${VALID_PLANS.join(', ')}` }, { status: 400 });
	}

	const userRef = adminDb.collection('users').doc(userId);
	const userDoc = await userRef.get();

	if (!userDoc.exists) {
		return json({ error: 'User not found' }, { status: 404 });
	}

	await userRef.update({ plan, storageLimit: TIER_CONFIG[plan as PlanTier].storageLimit });

	console.log(`[admin] Set plan for user ${userId} → ${plan}`);
	return json({ success: true, userId, plan });
};
