import type { RequestHandler } from './$types';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const formData = await request.formData();
		const sessionId = formData.get('sessionId') as string;
		const batchNumber = formData.get('batchNumber') as string;
		const startFrame = formData.get('startFrame') as string;
		const frameCount = parseInt(formData.get('frameCount') as string);

		console.log(`📦 Batch ${batchNumber}: ${frameCount} frames starting at ${startFrame}`);

		// Create session directory

		const isLinux = process.platform === 'linux';
		const baseTemp = isLinux ? '/dev/shm/contentfactory' : path.join(process.cwd(), 'temp');
		const tempDir = path.join(baseTemp, `session-${sessionId}`);

		if (!existsSync(tempDir)) {
			await mkdir(tempDir, { recursive: true });
		}

		// Write JPEG frames in parallel — each frame arrives as frame_0, frame_1, ...
		const writes: Promise<void>[] = [];
		for (let i = 0; i < frameCount; i++) {
			const frameFile = formData.get(`frame_${i}`) as File | null;
			if (!frameFile) throw new Error(`Missing frame_${i} in batch ${batchNumber}`);
			const globalFrameNumber = parseInt(startFrame) + i;
			const framePath = path.join(
				tempDir,
				`frame-${globalFrameNumber.toString().padStart(6, '0')}.jpg`
			);
			writes.push(frameFile.arrayBuffer().then((buf) => writeFile(framePath, Buffer.from(buf))));
		}
		await Promise.all(writes);

		console.log(`✅ Batch ${batchNumber} saved`);

		return new Response(JSON.stringify({ success: true }), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		console.error('❌ Batch upload error:', error);
		return new Response(
			JSON.stringify({
				error: 'Batch upload failed',
				details: error instanceof Error ? error.message : String(error)
			}),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
};
