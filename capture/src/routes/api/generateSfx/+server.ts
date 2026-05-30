// src/routes/api/generateSfx/+server.ts
// Calls ElevenLabs Sound Effects API, saves result to temp/audio/sfx-{sessionId}.mp3
// Returns sessionId (for FFmpeg mux at encode time) + previewUrl (for browser preview)

import type { RequestHandler } from './$types';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { ELEVEN_LABS_API_KEY } from '$env/static/private';

function getTempBase(): string {
	return process.platform === 'linux'
		? '/dev/shm/contentfactory'
		: path.join(process.cwd(), 'temp');
}

export const POST: RequestHandler = async ({ request }) => {
	const { prompt, durationSeconds = 5 } = await request.json();

	if (!prompt?.trim()) {
		return new Response(JSON.stringify({ error: 'Prompt is required' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const sessionId = Date.now().toString();
	const audioDir = path.join(getTempBase(), 'audio');
	const outputPath = path.join(audioDir, `sfx-${sessionId}.mp3`);

	try {
		if (!existsSync(audioDir)) {
			await mkdir(audioDir, { recursive: true });
		}

		console.log(`🔊 Generating SFX: "${prompt}"`);

		const response = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
			method: 'POST',
			headers: {
				'xi-api-key': ELEVEN_LABS_API_KEY,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				text: prompt,
				duration_seconds: durationSeconds,
				prompt_influence: 0.3
			})
		});

		if (!response.ok) {
			const err = await response.text();
			console.error('❌ ElevenLabs SFX error:', err);
			return new Response(JSON.stringify({ error: `ElevenLabs error: ${response.status}` }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const audioBuffer = Buffer.from(await response.arrayBuffer());
		await writeFile(outputPath, audioBuffer);
		console.log(`✅ SFX saved — sfx-${sessionId}.mp3`);

		// Convert to base64 so the browser can preview without a separate fetch
		const base64 = audioBuffer.toString('base64');
		const previewUrl = `data:audio/mpeg;base64,${base64}`;

		return new Response(JSON.stringify({ sfxSessionId: sessionId, previewUrl }), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		console.error('❌ SFX generation error:', error);
		return new Response(
			JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
};
