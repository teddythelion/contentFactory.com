// src/routes/api/usage/increment/+server.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { incrementUsage } from '$lib/services/usage.service';
import type { GenerationType } from '$lib/types/subscription';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const userId = locals.user?.uid;
		if (!userId) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { type } = await request.json() as { type: GenerationType };

		if (!type || !['image', 'video'].includes(type)) {
			return json({ error: 'Invalid generation type' }, { status: 400 });
		}

		await incrementUsage(userId, type);

		return json({ success: true });
	} catch (error: any) {
		console.error('Usage increment error:', error);
		return json({ error: error.message || 'Failed to increment usage' }, { status: 500 });
	}
};