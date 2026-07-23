// src/routes/api/admin/users/[uid]/+server.ts
// Session-gated admin mutation — set a user's plan and/or admin flag.
// This is an override: it writes Firestore directly and does not touch
// Stripe, so it does not create/cancel a real subscription. Used for comps,
// support fixes, and manual tier changes outside the checkout flow.

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/firebase/admin';
import { requireAdmin } from '$lib/server/adminAuth';
import { TIER_CONFIG, type PlanTier } from '$lib/types/subscription';

const VALID_PLANS = Object.keys(TIER_CONFIG) as PlanTier[];

export const PATCH: RequestHandler = async ({ request, locals, params }) => {
	await requireAdmin(locals.user?.uid);

	const targetUid = params.uid!;
	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') {
		return json({ error: 'Invalid body' }, { status: 400 });
	}

	const { plan, isAdmin } = body as { plan?: PlanTier; isAdmin?: boolean };
	if (plan === undefined && isAdmin === undefined) {
		return json({ error: 'Nothing to update — provide plan and/or isAdmin' }, { status: 400 });
	}
	if (plan !== undefined && !VALID_PLANS.includes(plan)) {
		return json({ error: `Invalid plan. Must be one of: ${VALID_PLANS.join(', ')}` }, { status: 400 });
	}
	if (isAdmin !== undefined && typeof isAdmin !== 'boolean') {
		return json({ error: 'isAdmin must be boolean' }, { status: 400 });
	}

	const userRef = adminDb.collection('users').doc(targetUid);
	const userDoc = await userRef.get();
	if (!userDoc.exists) {
		return json({ error: 'User not found' }, { status: 404 });
	}

	const updates: Record<string, unknown> = {};
	if (plan !== undefined) {
		updates.plan = plan;
		updates.storageLimit = TIER_CONFIG[plan].storageLimit;
	}
	if (isAdmin !== undefined) {
		updates.isAdmin = isAdmin;
	}

	await userRef.update(updates);

	console.log(`[admin] ${locals.user!.uid} updated ${targetUid} →`, updates);
	return json({ success: true, uid: targetUid, ...updates });
};
