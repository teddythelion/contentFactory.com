import { GEMINI_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, request }) => {
	try {
		const videoUrl = url.searchParams.get('url');
		const downloadName = url.searchParams.get('download'); // present = force download with this filename

		if (!videoUrl) {
			return new Response(JSON.stringify({ error: 'Video URL is required' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Forward the Range header so the browser can seek within the video.
		// Without this, the browser receives the video as a non-seekable stream
		// and videoElement.currentTime = targetTime never fires 'seeked' at the
		// correct position — all captured frames end up at t=0.
		const rangeHeader = request.headers.get('range');
		const upstreamHeaders: Record<string, string> = {};
		if (rangeHeader) {
			upstreamHeaders['Range'] = rangeHeader;
		}

		// Gemini Files API URLs need the API key added server-side and use the
		// /download/ path for media streaming. We handle that transparently here
		// so the API key is never exposed to the browser.
		let fetchUrl = videoUrl;
		if (videoUrl.includes('generativelanguage.googleapis.com')) {
			fetchUrl = videoUrl.includes('?')
				? `${videoUrl}&key=${GEMINI_API_KEY}`
				: `${videoUrl}:download?alt=media&key=${GEMINI_API_KEY}`;
		}

		const upstream = await fetch(fetchUrl, { headers: upstreamHeaders });

		if (!upstream.ok && upstream.status !== 206) {
			console.error('❌ Failed to fetch video from upstream:', upstream.status);
			return new Response(JSON.stringify({ error: 'Failed to fetch video' }), {
				status: upstream.status,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const responseHeaders: Record<string, string> = {
			'Content-Type': upstream.headers.get('Content-Type') || 'video/mp4',
			'Access-Control-Allow-Origin': '*',
			'Cache-Control': 'public, max-age=3600',
			'Accept-Ranges': 'bytes'
		};

		if (downloadName) {
			responseHeaders['Content-Disposition'] = `attachment; filename="${downloadName}"`;
		}

		// Forward range-related headers from the upstream GCS response.
		const contentLength = upstream.headers.get('Content-Length');
		if (contentLength) responseHeaders['Content-Length'] = contentLength;

		const contentRange = upstream.headers.get('Content-Range');
		if (contentRange) responseHeaders['Content-Range'] = contentRange;

		// Stream the body instead of buffering the whole video in memory.
		return new Response(upstream.body, {
			status: upstream.status,
			headers: responseHeaders
		});
	} catch (error) {
		console.error('❌ Video proxy error:', error);
		return new Response(JSON.stringify({ error: 'Failed to proxy video' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
