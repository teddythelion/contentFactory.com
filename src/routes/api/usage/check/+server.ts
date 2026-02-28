// src/routes/api/usage/check/+server.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { checkUsage } from '$lib/services/usage.service.ts';
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

		const result = await checkUsage(userId, type);

		return json(result);
	} catch (error: any) {
		console.error('Usage check error:', error);
		return json({ error: error.message || 'Failed to check usage' }, { status: 500 });
	}
};