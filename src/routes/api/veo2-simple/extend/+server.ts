import { GoogleGenAI } from '@google/genai';
import { GOOGLE_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';
import { checkUsage, incrementUsage } from '$lib/services/usage.service';

const ai = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });

export const POST: RequestHandler = async ({ request, locals }) => {
	const userId = locals.user?.uid;
	if (!userId) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
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

		// Pass ONLY uri — the SDK maps mimeType → encoding on the wire which the API rejects
		const video = { uri: videoObject.uri as string };

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const operation = await (ai.models as any).generateVideos({
			model: 'veo-3.1-generate-preview',
			prompt: prompt || '',
			video,
			config: {
				numberOfVideos: 1,
				durationSeconds: 8,  // must be 8 for extension
				resolution: '720p',  // must be 720p for extension
			},
		});

		console.log(`✅ Extension operation started: ${operation.name}`);
		await incrementUsage(userId, 'video');

		return new Response(JSON.stringify({ operation: operation.name }), {
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
