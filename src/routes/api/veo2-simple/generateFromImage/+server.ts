import type { RequestHandler } from './$types';
import { checkUsage, incrementUsage, getUserPlan } from '$lib/services/usage.service';
import { TIER_CONFIG } from '$lib/types/subscription';
import { getVideoProvider } from '$lib/providers';

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

	const contentType = request.headers.get('content-type') || '';
	let prompt: string;
	let duration = 8;
	let aspectRatio = '16:9';
	type ImageRef = { imageBytes: string; mimeType: string };
	const refImages: ImageRef[] = [];

	let quality = 'fast';

	try {
		if (contentType.includes('multipart/form-data')) {
			const formData = await request.formData();
			prompt = formData.get('prompt') as string;
			duration = parseInt(formData.get('duration') as string) || 8;
			aspectRatio = (formData.get('aspectRatios') as string) || '16:9';
			quality = (formData.get('quality') as string) || 'fast';

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
			quality = body.quality || 'fast';
		}

		if (!prompt?.trim()) {
			return new Response(JSON.stringify({ error: 'Prompt is required' }), { status: 400 });
		}

		const validDurations = [4, 6, 8];
		const clampedDuration = validDurations.includes(duration) ? duration : 8;

		const plan = await getUserPlan(userId);
		const tierLimits = TIER_CONFIG[plan];

		// Server enforces model AND credits. Premium quality burns a PREMIUM credit
		// (separate pool — real cost is 4× fast); when the plan disallows it or
		// credits are spent, the request gracefully downgrades to the fast pool
		// instead of failing, and the response says so.
		let usePremium = quality === 'premium' && tierLimits.canUsePremiumQuality;
		let premiumDowngraded = false;
		if (usePremium) {
			const premiumCheck = await checkUsage(userId, 'premium_video');
			if (!premiumCheck.allowed) {
				usePremium = false;
				premiumDowngraded = true;
				console.log(`⬇️ Premium credits exhausted for ${userId} (${plan}) — downgrading to fast model`);
			}
		}
		if (!usePremium) {
			const usageCheck = await checkUsage(userId, 'video');
			if (!usageCheck.allowed) {
				return new Response(JSON.stringify({ error: 'limit_reached', usage: usageCheck }), { status: 429 });
			}
		}
		const usageType = usePremium ? 'premium_video' as const : 'video' as const;
		const model = usePremium ? 'veo-3.1-generate-preview' : tierLimits.videoModel;

		const modeMap = ['text-to-video', 'first-frame animation', 'interpolation (start→end)', 'interpolation (start→mid→end)'];
		const mode = modeMap[refImages.length] ?? modeMap[0];
		console.log(`🎬 ${model} | ${mode} | "${prompt.substring(0, 60)}..." | ${clampedDuration}s | ${aspectRatio} | ${refImages.length} image(s)`);

		const provider = getVideoProvider();
		const operation = await provider.generateVideo({
			model,
			prompt,
			durationSeconds: clampedDuration,
			aspectRatio,
			resolution: '720p',
			images: refImages,
		});

		console.log(`✅ Operation started: ${operation.id}`);
		await incrementUsage(userId, usageType);

		return new Response(JSON.stringify({
			operation: operation.id,
			mode,
			premiumDowngraded, // true = premium requested but credits spent; ran on fast model
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
