import type { RequestHandler } from './$types';
import { getVideoProvider } from '$lib/providers';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { operation: operationName } = await request.json();

		if (!operationName) {
			return new Response(JSON.stringify({ done: false, error: 'Operation name is required' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		console.log(`📋 Polling operation: ${operationName}`);

		const provider = getVideoProvider();
		const result = await provider.pollVideo(operationName);

		if (!result.done) {
			console.log('⏳ Still processing...');
			return new Response(JSON.stringify({ done: false }), {
				headers: { 'Content-Type': 'application/json' },
			});
		}

		console.log('✅ Operation complete');

		if (result.error || !result.fileUri) {
			console.error(`❌ ${result.error ?? 'No video URI in response'}`);
			return new Response(JSON.stringify({ done: true, error: result.error ?? 'No video generated' }), {
				headers: { 'Content-Type': 'application/json' },
			});
		}

		console.log(`📹 Video file URI: ${result.fileUri}`);

		// Proxy URL for the <video> element — keeps the API key server-side
		const proxyUrl = `/api/proxyVideo?url=${encodeURIComponent(result.fileUri)}`;

		// Pass the full video object back to the frontend so the extend endpoint
		// receives it verbatim and passes it as `video:` to generateVideos —
		// matching the official extension example exactly.
		return new Response(JSON.stringify({
			done: true,
			video: proxyUrl,             // used by <video src=...>
			videoObject: result.videoObject, // { uri, mimeType, videoBytes? } — stored for extension
		}), {
			headers: { 'Content-Type': 'application/json' },
		});

	} catch (error) {
		console.error('❌ Poll error:', error);
		return new Response(JSON.stringify({
			done: true,
			error: 'Polling failed',
			details: error instanceof Error ? error.message : String(error),
		}), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};
