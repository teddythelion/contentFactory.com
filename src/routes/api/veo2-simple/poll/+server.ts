import { GoogleGenAI, GenerateVideosOperation } from '@google/genai';
import { GOOGLE_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';

const ai = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });

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

		// getVideosOperation requires a real GenerateVideosOperation instance (not a plain
		// object) because it calls operation._fromAPIResponse() internally. We create one
		// and stamp the name so the SDK can look it up and populate the result correctly.
		const opInstance = new GenerateVideosOperation();
		(opInstance as unknown as Record<string, unknown>).name = operationName;

		const operation = await ai.operations.getVideosOperation({ operation: opInstance });

		if (!operation.done) {
			console.log('⏳ Still processing...');
			return new Response(JSON.stringify({ done: false }), {
				headers: { 'Content-Type': 'application/json' },
			});
		}

		console.log('✅ Operation complete');

		const generatedVideo = operation.response?.generatedVideos?.[0];
		if (!generatedVideo?.video) {
			console.error('❌ No video in response');
			return new Response(JSON.stringify({ done: true, error: 'No video generated' }), {
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const videoFile = generatedVideo.video;
		const fileUri = videoFile?.uri;

		if (!fileUri) {
			console.error('❌ No URI on video file');
			return new Response(JSON.stringify({ done: true, error: 'No video URI in response' }), {
				headers: { 'Content-Type': 'application/json' },
			});
		}

		console.log(`📹 Video file URI: ${fileUri}`);

		// Proxy URL for the <video> element — keeps the API key server-side
		const proxyUrl = `/api/proxyVideo?url=${encodeURIComponent(fileUri)}`;

		// Pass the full video object back to the frontend so the extend endpoint
		// receives it verbatim and passes it as `video:` to generateVideos —
		// matching the official extension example exactly.
		return new Response(JSON.stringify({
			done: true,
			video: proxyUrl,       // used by <video src=...>
			videoObject: videoFile, // { uri, mimeType, videoBytes? } — stored for extension
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
