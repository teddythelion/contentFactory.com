import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const videoUrl = url.searchParams.get('url');

		if (!videoUrl) {
			return new Response(
				JSON.stringify({ error: 'Video URL is required' }),
				{
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}

		console.log('📹 Proxying video from:', videoUrl);

		const response = await fetch(videoUrl);

		if (!response.ok) {
			console.error('❌ Failed to fetch video:', response.status);
			return new Response(
				JSON.stringify({ error: 'Failed to fetch video' }),
				{
					status: response.status,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}

		const videoBuffer = await response.arrayBuffer();

		return new Response(videoBuffer, {
			headers: {
				'Content-Type': 'video/mp4',
				'Content-Length': videoBuffer.byteLength.toString(),
				'Access-Control-Allow-Origin': '*',
				'Cache-Control': 'public, max-age=3600'
			}
		});
	} catch (error) {
		console.error('❌ Video proxy error:', error);
		return new Response(
			JSON.stringify({ error: 'Failed to proxy video' }),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
};