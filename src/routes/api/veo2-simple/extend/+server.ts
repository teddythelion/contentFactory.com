import type { RequestHandler } from './$types';
import { checkUsage, incrementUsage, getUserPlan } from '$lib/services/usage.service';
import { TIER_CONFIG } from '$lib/types/subscription';
import { getVideoProvider } from '$lib/providers';

export const POST: RequestHandler = async ({ request, locals }) => {
	const userId = locals.user?.uid;
	if (!userId) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
	}

	const plan = await getUserPlan(userId);
	if (!TIER_CONFIG[plan].canExtend) {
		return new Response(JSON.stringify({ error: 'upgrade_required', feature: 'extend', plan }), { status: 403 });
	}

	const provider = getVideoProvider();
	if (!provider.supportsExtend) {
		return new Response(JSON.stringify({ error: 'unsupported', feature: 'extend', provider: provider.name }), { status: 501 });
	}

	const usageCheck = await checkUsage(userId, 'video');
	if (!usageCheck.allowed) {
		return new Response(JSON.stringify({ error: 'limit_reached', usage: usageCheck }), { status: 429 });
	}

	try {
		// videoObject is the full Video object from operation.response.generatedVideos[0].video
		// passed through verbatim — { uri, mimeType, videoBytes? }
		const { videoObject, prompt } = await request.json();

		if (!videoObject) {
			return new Response(JSON.stringify({ error: 'videoObject is required' }), { status: 400 });
		}

		console.log(`🎬 Extending video (uri: ${videoObject.uri?.substring(0, 60) ?? 'n/a'}...)`);
		console.log(`   Prompt: "${(prompt || '(continue naturally)').substring(0, 80)}"`);

		const operation = await provider.extendVideo({
			model: 'veo-3.1-generate-preview',
			prompt: prompt || '',
			videoUri: videoObject.uri as string,
		});

		console.log(`✅ Extension operation started: ${operation.id}`);
		await incrementUsage(userId, 'video');

		return new Response(JSON.stringify({ operation: operation.id }), {
			headers: { 'Content-Type': 'application/json' },
		});

	} catch (error) {
		console.error('❌ Video extension error:', error);
		return new Response(JSON.stringify({
			error: 'Failed to start video extension',
			details: error instanceof Error ? error.message : String(error),
		}), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};
