import type { RequestHandler } from './$types';
import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

function getTempBase(): string {
	return process.platform === 'linux'
		? '/dev/shm/contentfactory'
		: path.join(process.cwd(), 'temp');
}

export const POST: RequestHandler = async ({ request }) => {
	const sessionId = Date.now().toString();
	const audioDir = path.join(getTempBase(), 'audio');
	const outputPath = path.join(audioDir, `music-${sessionId}.mp3`);

	try {
		if (!existsSync(audioDir)) {
			await mkdir(audioDir, { recursive: true });
		}

		const formData = await request.formData();
		const file = formData.get('file') as File | null;

		if (!file) {
			return new Response(JSON.stringify({ error: 'No file provided' }), { status: 400 });
		}

		const buffer = Buffer.from(await file.arrayBuffer());
		await writeFile(outputPath, buffer);

		console.log(`✅ Music file saved — music-${sessionId}.mp3`);

		return new Response(JSON.stringify({ sessionId }), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		console.error('❌ Failed to save music file:', error);
		return new Response(
			JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
};
