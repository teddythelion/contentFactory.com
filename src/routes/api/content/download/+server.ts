// src/routes/api/content/download/+server.ts
import { GOOGLE_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const fileUrl = url.searchParams.get('url');
	const fileName = url.searchParams.get('name') || 'download';

	if (!fileUrl) {
		return new Response('Missing url parameter', { status: 400 });
	}

	// Build an absolute fetch URL — server-side fetch cannot use relative URLs.
	// Gemini Files API URLs need the API key appended server-side.
	let fetchUrl = fileUrl;
	if (fileUrl.includes('generativelanguage.googleapis.com')) {
		fetchUrl = fileUrl.includes('?')
			? `${fileUrl}&key=${GOOGLE_API_KEY}`
			: `${fileUrl}:download?alt=media&key=${GOOGLE_API_KEY}`;
	} else if (fileUrl.startsWith('/')) {
		// Relative proxy URL — extract the inner Gemini URL and handle directly
		const innerUrl = new URL(fileUrl, 'http://localhost').searchParams.get('url');
		if (innerUrl && innerUrl.includes('generativelanguage.googleapis.com')) {
			fetchUrl = innerUrl.includes('?')
				? `${innerUrl}&key=${GOOGLE_API_KEY}`
				: `${innerUrl}:download?alt=media&key=${GOOGLE_API_KEY}`;
		} else {
			return new Response('Cannot resolve relative URL for download', { status: 400 });
		}
	}

	const response = await fetch(fetchUrl);

	if (!response.ok) {
		return new Response('Failed to fetch file', { status: 502 });
	}

	const contentType = response.headers.get('content-type') || 'application/octet-stream';
	const body = await response.arrayBuffer();

	return new Response(body, {
		headers: {
			'Content-Type': contentType,
			'Content-Disposition': `attachment; filename="${fileName}"`,
			'Content-Length': String(body.byteLength)
		}
	});
};
