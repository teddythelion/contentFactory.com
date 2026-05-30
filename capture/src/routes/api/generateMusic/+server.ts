// src/routes/api/generateMusic/+server.ts
// Uses ElevenLabs SDK — streams directly to disk, no polling needed.

import type { RequestHandler } from './$types';
import { mkdir } from 'fs/promises';
import { existsSync, createWriteStream } from 'fs';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import path from 'path';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { ELEVEN_LABS_API_KEY } from '$env/static/private';

function getTempBase(): string {
	return process.platform === 'linux'
		? '/dev/shm/contentfactory'
		: path.join(process.cwd(), 'temp');
}

export const POST: RequestHandler = async ({ request }) => {
	const { prompt, durationMs = 30000 } = await request.json();

	if (!prompt?.trim()) {
		return new Response(JSON.stringify({ error: 'Prompt is required' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const sessionId = Date.now().toString();
	const audioDir = path.join(getTempBase(), 'audio');
	const outputPath = path.join(audioDir, `music-${sessionId}.mp3`);

	try {
		if (!existsSync(audioDir)) {
			await mkdir(audioDir, { recursive: true });
		}

		console.log(`🎵 Generating music: "${prompt}"`);

		const elevenlabs = new ElevenLabsClient({ apiKey: ELEVEN_LABS_API_KEY });

		const track = await elevenlabs.music.compose({
			prompt,
			musicLengthMs: durationMs
		});

		await pipeline(Readable.from(track), createWriteStream(outputPath));
		console.log(`✅ Music saved — music-${sessionId}.mp3`);

		// Read back for base64 preview
		const { readFile } = await import('fs/promises');
		const audioBuffer = await readFile(outputPath);
		const base64 = audioBuffer.toString('base64');
		const previewUrl = `data:audio/mpeg;base64,${base64}`;

		return new Response(JSON.stringify({ musicSessionId: sessionId, previewUrl }), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		console.error('❌ Music generation error:', error);
		return new Response(
			JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
};
