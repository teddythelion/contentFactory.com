// src/routes/api/content/download/+server.ts
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const fileUrl = url.searchParams.get('url');
	const fileName = url.searchParams.get('name') || 'download';

	if (!fileUrl) {
		return new Response('Missing url parameter', { status: 400 });
	}

	const response = await fetch(fileUrl);

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
