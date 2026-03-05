import type { RequestHandler } from './$types';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, unlink, rmdir, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { createRequire } from 'module';
import sharp from 'sharp';
import { encodeJobs, pruneOldJobs } from '$lib/server/jobStore';
import { uploadToGCS, updateUserStorage, incrementContentStats } from '$lib/firebase/storage';
import { adminDb } from '$lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

const require = createRequire(import.meta.url);
const execAsync = promisify(exec);

function getFFmpegPath(): string {
	if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
	try {
		const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
		if (ffmpegInstaller.path) return ffmpegInstaller.path;
	} catch {
		console.error('caught');
	}
	return 'ffmpeg';
}

const FFMPEG_PATH = getFFmpegPath();
const PARALLEL_BATCH_SIZE = 8;

async function runEncode(
	sessionId: string,
	totalFrames: number,
	fps: number,
	width: number,
	height: number,
	userId: string
) {
	const sessionDir = path.join(process.cwd(), 'temp', `session-${sessionId}`);
	const outputPath = path.join(process.cwd(), 'temp', `output-${sessionId}.mp4`);

	try {
		console.log(`🎬 Encoding ${totalFrames} frames from session ${sessionId}`);
		console.log(`🖼️ Converting raw frames to PNG (${PARALLEL_BATCH_SIZE} at a time)...`);

		for (let i = 0; i < totalFrames; i += PARALLEL_BATCH_SIZE) {
			const batchEnd = Math.min(i + PARALLEL_BATCH_SIZE, totalFrames);
			const batchPromises = [];

			for (let j = i; j < batchEnd; j++) {
				const rawPath = path.join(sessionDir, `frame-${j.toString().padStart(6, '0')}.raw`);
				const pngPath = path.join(sessionDir, `frame-${j.toString().padStart(6, '0')}.png`);

				batchPromises.push(
					readFile(rawPath).then((rawBuffer) =>
						sharp(rawBuffer, { raw: { width, height, channels: 4 } })
							.png()
							.toFile(pngPath)
							.then(() => unlink(rawPath))
					)
				);
			}

			await Promise.all(batchPromises);

			if (i % 30 === 0) {
				console.log(
					`  Converted ${Math.min(i + PARALLEL_BATCH_SIZE, totalFrames)}/${totalFrames} frames`
				);
			}
		}

		console.log('✅ Frame conversion complete');

		const command = [
			`"${FFMPEG_PATH}"`,
			`-framerate ${fps}`,
			`-i "${path.join(sessionDir, 'frame-%06d.png')}"`,
			`-vf "scale=trunc(iw/2)*2:trunc(ih/2)*2"`,
			`-c:v libx264`,
			`-preset veryfast`,
			`-crf 23`,
			`-b:v 5M`,
			`-pix_fmt yuv420p`,
			`-movflags +faststart`,
			`"${outputPath}"`
		].join(' ');

		console.log('Executing:', command);
		await execAsync(command, { maxBuffer: 50 * 1024 * 1024 });
		console.log('✅ Encoding complete');

		const videoBuffer = await readFile(outputPath);
		const timestamp = Date.now();
		const fileName = `enhanced-video-${timestamp}.mp4`;

		// Use the same uploadToGCS that the rest of the app uses — credentials already wired
		const uploadResult = await uploadToGCS(userId, videoBuffer, fileName, 'video/mp4', 'videos');
		console.log(`☁️ Uploaded to GCS: ${uploadResult.publicUrl}`);

		// Save to Firestore content library
		const contentRef = adminDb.collection('content').doc();
		const contentId = contentRef.id;

		await contentRef.set({
			contentId,
			userId,
			type: 'video',
			title: `Enhanced Video ${timestamp}`,
			description: 'Three.js enhanced video',
			prompt: '',
			gcsPath: uploadResult.gcsPath,
			publicUrl: uploadResult.publicUrl,
			thumbnailUrl: null,
			width,
			height,
			fileSize: uploadResult.fileSize,
			format: 'mp4',
			duration: null,
			model: 'three.js-enhancement',
			generationTime: 0,
			createdAt: Timestamp.now(),
			updatedAt: Timestamp.now(),
			tags: ['enhanced', 'three-js'],
			category: null,
			status: 'ready',
			timesPosted: 0,
			timesDownloaded: 0,
			isPinned: false,
			markedForDeletion: false,
			deletionScheduledFor: null,
			deletionWarningsSent: 0,
			isUsedInPost: false
		});

		// Update user stats
		await updateUserStorage(userId, uploadResult.fileSize);
		await incrementContentStats(userId, 'video');

		// Cleanup temp files
		const files = await readdir(sessionDir).catch(() => []);
		for (const f of files) await unlink(path.join(sessionDir, f)).catch(() => {});
		await rmdir(sessionDir).catch(() => {});
		await unlink(outputPath).catch(() => {});

		encodeJobs.set(sessionId, {
			status: 'complete',
			gcsUrl: uploadResult.publicUrl,
			createdAt: encodeJobs.get(sessionId)!.createdAt
		});

		console.log(`✅ Job ${sessionId} complete — saved to library for user ${userId}`);
	} catch (error) {
		console.error('❌ Encoding error:', error);

		if (existsSync(sessionDir)) {
			const files = await readdir(sessionDir).catch(() => []);
			for (const f of files) await unlink(path.join(sessionDir, f)).catch(() => {});
			await rmdir(sessionDir).catch(() => {});
		}
		if (existsSync(outputPath)) await unlink(outputPath).catch(() => {});

		encodeJobs.set(sessionId, {
			status: 'error',
			error: error instanceof Error ? error.message : String(error),
			createdAt: encodeJobs.get(sessionId)!.createdAt
		});
	}
}

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { sessionId, totalFrames, fps, width, height, userId } = body;

	if (!userId) {
		return new Response(JSON.stringify({ error: 'Missing userId' }), { status: 400 });
	}

	pruneOldJobs();
	encodeJobs.set(sessionId, { status: 'processing', createdAt: Date.now() });

	runEncode(sessionId, totalFrames, fps, width, height, userId);

	return new Response(JSON.stringify({ success: true, jobId: sessionId }), {
		headers: { 'Content-Type': 'application/json' }
	});
};
