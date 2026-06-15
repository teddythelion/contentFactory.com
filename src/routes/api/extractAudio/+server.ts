// src/routes/api/extractAudio/+server.ts
// Extracts audio track from a video before it enters the Three.js canvas.
// Called by openVideoEnhancer() on the client before the enhancer opens.
// Returns a sessionId tied to the preserved .aac file on the server.
// If the video has no audio track, returns audioSessionId: null — caller handles gracefully.

import type { RequestHandler } from './$types';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { GOOGLE_API_KEY } from '$env/static/private';

const require = createRequire(import.meta.url);
const execAsync = promisify(exec);

function getFFmpegPath(): string {
	if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
	try {
		const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
		if (ffmpegInstaller.path) return ffmpegInstaller.path;
	} catch {
		// fall through to default
	}
	return 'ffmpeg';
}

const FFMPEG_PATH = getFFmpegPath();

function getTempBase(): string {
	const isLinux = process.platform === 'linux';
	return isLinux ? '/dev/shm/contentfactory' : path.join(process.cwd(), 'temp');
}

export const POST: RequestHandler = async ({ request }) => {
	const sessionId = Date.now().toString();
	const baseTemp = getTempBase();
	const audioDir = path.join(baseTemp, 'audio');
	const audioOutputPath = path.join(audioDir, `audio-${sessionId}.aac`);
	let tempVideoPath: string | null = null;

	try {
		// Ensure audio temp directory exists
		if (!existsSync(audioDir)) {
			await mkdir(audioDir, { recursive: true });
		}

		const formData = await request.formData();
		const videoUrl = formData.get('videoUrl') as string | null;
		const videoFile = formData.get('videoFile') as File | null;

		let inputPath: string;

		if (videoFile) {
			tempVideoPath = path.join(audioDir, `input-${sessionId}.mp4`);
			const buffer = Buffer.from(await videoFile.arrayBuffer());
			await writeFile(tempVideoPath, buffer);
			inputPath = tempVideoPath;
		} else if (videoUrl && videoUrl.startsWith('http')) {
			// Always download to a temp file — passing URLs with & directly to exec()
			// causes the shell to split the command at the & character.
			let fetchUrl = videoUrl;
			if (videoUrl.includes('generativelanguage.googleapis.com')) {
				fetchUrl = videoUrl.includes('?')
					? `${videoUrl}&key=${GOOGLE_API_KEY}`
					: `${videoUrl}:download?alt=media&key=${GOOGLE_API_KEY}`;
			}
			const res = await fetch(fetchUrl);
			if (!res.ok) throw new Error(`Failed to download video: ${res.status} ${res.statusText}`);
			tempVideoPath = path.join(audioDir, `input-${sessionId}.mp4`);
			await writeFile(tempVideoPath, Buffer.from(await res.arrayBuffer()));
			inputPath = tempVideoPath;
		} else {
			return new Response(JSON.stringify({ error: 'No valid video source provided' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Probe first — check if the video actually has an audio stream.
		// FIX: Don't use shell piping or grep — neither works reliably on Windows.
		// FFmpeg always writes stream info to stderr. We capture it directly in Node
		// and check the string there, no shell gymnastics needed.
		let hasAudio = false;
		try {
			// ffmpeg -i always exits with code 1 when no output is specified,
			// so we use || true / stdio capture to avoid an execAsync throw.
			const probeResult = await execAsync(`"${FFMPEG_PATH}" -i "${inputPath}" -hide_banner`, {
				// No shell override needed — works on both Windows and Linux
				// Capture stderr where ffmpeg writes stream info
			}).catch((err) => {
				// ffmpeg -i with no output always throws — that's expected.
				// The stream info we need is in err.stderr.
				return { stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
			});

			const probeOutput = probeResult.stdout + probeResult.stderr;
			hasAudio = probeOutput.includes('Audio:');
		} catch {
			// Probe completely failed — assume no audio, return null gracefully
			hasAudio = false;
		}

		if (!hasAudio) {
			// Clean up temp input if we wrote one
			if (tempVideoPath && existsSync(tempVideoPath)) {
				await unlink(tempVideoPath).catch(() => {});
			}
			return new Response(
				JSON.stringify({ audioSessionId: null, message: 'No audio track found in video' }),
				{ headers: { 'Content-Type': 'application/json' } }
			);
		}

		// Extract audio track to AAC
		// -vn = no video, -c:a aac = encode to AAC, -b:a 192k = good quality
		const extractCommand = [
			`"${FFMPEG_PATH}"`,
			`-i "${inputPath}"`,
			`-vn`,
			`-c:a aac`,
			`-b:a 192k`,
			`-y`,
			`"${audioOutputPath}"`
		].join(' ');

		console.log(`🎵 Extracting audio for session ${sessionId}...`);
		await execAsync(extractCommand, { maxBuffer: 50 * 1024 * 1024 });
		console.log(`✅ Audio extracted — audio-${sessionId}.aac`);

		// Clean up temp input video if we wrote one
		if (tempVideoPath && existsSync(tempVideoPath)) {
			await unlink(tempVideoPath).catch(() => {});
		}

		return new Response(JSON.stringify({ audioSessionId: sessionId }), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		console.error('❌ Audio extraction error:', error);

		// Clean up on error
		if (tempVideoPath && existsSync(tempVideoPath)) {
			await unlink(tempVideoPath).catch(() => {});
		}
		if (existsSync(audioOutputPath)) {
			await unlink(audioOutputPath).catch(() => {});
		}

		return new Response(
			JSON.stringify({
				error: 'Audio extraction failed',
				details: error instanceof Error ? error.message : String(error)
			}),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
};
