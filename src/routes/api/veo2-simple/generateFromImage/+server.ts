import { GoogleGenAI } from '@google/genai';
import { GOOGLE_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';
import { checkUsage, incrementUsage } from '$lib/services/usage.service';

const ai = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });

function getMimeType(filename: string): string {
	const ext = filename.toLowerCase().split('.').pop();
	const map: Record<string, string> = {
		jpg: 'image/jpeg', jpeg: 'image/jpeg',
		png: 'image/png', gif: 'image/gif', webp: 'image/webp'
	};
	return map[ext || 'jpg'] || 'image/jpeg';
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const userId = locals.user?.uid;
	if (!userId) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
	}

	const usageCheck = await checkUsage(userId, 'video');
	if (!usageCheck.allowed) {
		return new Response(JSON.stringify({ error: 'limit_reached', usage: usageCheck }), { status: 429 });
	}

	const contentType = request.headers.get('content-type') || '';
	let prompt: string;
	let duration = 8;
	let aspectRatio = '16:9';
	type ImageRef = { imageBytes: string; mimeType: string };
	const refImages: ImageRef[] = [];

	try {
		if (contentType.includes('multipart/form-data')) {
			const formData = await request.formData();
			prompt = formData.get('prompt') as string;
			duration = parseInt(formData.get('duration') as string) || 8;
			aspectRatio = (formData.get('aspectRatios') as string) || '16:9';

			const images = (formData.getAll('images') as File[]).slice(0, 3); // max 3
			for (const img of images) {
				const buf = await img.arrayBuffer();
				refImages.push({ imageBytes: Buffer.from(buf).toString('base64'), mimeType: getMimeType(img.name) });
			}
		} else {
			const body = await request.json();
			prompt = body.prompt;
			duration = body.duration || 8;
			aspectRatio = body.aspectRatios || '16:9';
		}

		if (!prompt?.trim()) {
			return new Response(JSON.stringify({ error: 'Prompt is required' }), { status: 400 });
		}

		const validDurations = [4, 6, 8];
		const clampedDuration = validDurations.includes(duration) ? duration : 8;

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const generateParams: any = {
			model: 'veo-3.1-generate-preview',
			prompt,
			config: {
				numberOfVideos: 1,
				durationSeconds: clampedDuration,
				aspectRatio,
				resolution: '720p',
				personGeneration: 'allow_all',
			},
		};

		// 1 image → first-frame animation
		// 2 images → interpolate start → end
		// 3 images → interpolate start → middle → end
		if (refImages.length === 1) {
			generateParams.image = { imageBytes: refImages[0].imageBytes, mimeType: refImages[0].mimeType };
		} else if (refImages.length === 2) {
			generateParams.image     = { imageBytes: refImages[0].imageBytes, mimeType: refImages[0].mimeType };
			generateParams.lastImage = { imageBytes: refImages[1].imageBytes, mimeType: refImages[1].mimeType };
		} else if (refImages.length === 3) {
			generateParams.image        = { imageBytes: refImages[0].imageBytes, mimeType: refImages[0].mimeType };
			generateParams.middleImage  = { imageBytes: refImages[1].imageBytes, mimeType: refImages[1].mimeType };
			generateParams.lastImage    = { imageBytes: refImages[2].imageBytes, mimeType: refImages[2].mimeType };
		}

		const modeMap = ['text-to-video', 'first-frame animation', 'interpolation (start→end)', 'interpolation (start→mid→end)'];
		const mode = modeMap[refImages.length] ?? modeMap[0];
		console.log(`🎬 veo-3.1-generate-preview | ${mode} | "${prompt.substring(0, 60)}..." | ${clampedDuration}s | ${aspectRatio} | ${refImages.length} image(s)`);

		const operation = await ai.models.generateVideos(generateParams);

		console.log(`✅ Operation started: ${operation.name}`);
		await incrementUsage(userId, 'video');

		return new Response(JSON.stringify({
			operation: operation.name,
			mode,
		}), {
			headers: { 'Content-Type': 'application/json' },
		});

	} catch (error) {
		console.error('❌ Video generation error:', error);
		return new Response(JSON.stringify({
			error: 'Failed to start video generation',
			details: error instanceof Error ? error.message : String(error),
		}), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};
