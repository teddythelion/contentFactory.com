// src/routes/api/uploadCapturedVideo/+server.ts
// Receives the browser-encoded (WebCodecs) mp4 as a single upload and parks it
// in the temp base as capture-{sessionId}.mp4. /api/encodeFromBatches with
// preEncoded:true picks it up and skips Pass 1 entirely (-c:v copy only).

import type { RequestHandler } from './$types';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const formData = await request.formData();
		const sessionId = formData.get('sessionId');
		// sessionId is Date.now().toString() from the client — digits only, and it
		// becomes part of a filesystem path, so reject anything else.
		if (typeof sessionId !== 'string' || !/^\d+$/.test(sessionId)) {
			return new Response(JSON.stringify({ error: 'Invalid sessionId' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const video = formData.get('video');
		if (!(video instanceof File) || video.size === 0) {
			return new Response(JSON.stringify({ error: 'Missing video file' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const isLinux = process.platform === 'linux';
		const baseTemp = isLinux ? '/dev/shm/contentfactory' : path.join(process.cwd(), 'temp');
		if (!existsSync(baseTemp)) {
			await mkdir(baseTemp, { recursive: true });
		}

		const buffer = Buffer.from(await video.arrayBuffer());
		await writeFile(path.join(baseTemp, `capture-${sessionId}.mp4`), buffer);

		console.log(
			`📦 Pre-encoded capture saved — session ${sessionId}, ${(buffer.length / 1048576).toFixed(2)}MB`
		);

		return new Response(JSON.stringify({ success: true }), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		console.error('❌ Captured video upload error:', error);
		return new Response(
			JSON.stringify({
				error: 'Captured video upload failed',
				details: error instanceof Error ? error.message : String(error)
			}),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
};
