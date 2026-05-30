// src/routes/api/encodeFromBatches/+server.ts
// UPDATED: After silent video encode completes, checks for a preserved
// audio session and runs a second FFmpeg mux pass to reattach the audio
// before uploading to GCS. If audioSessionId is null or audio file is
// missing, skips mux and uploads the silent video as before — no regression.

import type { RequestHandler } from './$types';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, unlink, readdir, rmdir, rename } from 'fs/promises';
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

function getTempBase(): string {
	const isLinux = process.platform === 'linux';
	return isLinux ? '/dev/shm/contentfactory' : path.join(process.cwd(), 'temp');
}

async function runEncode(
	sessionId: string,
	totalFrames: number,
	fps: number,
	width: number,
	height: number,
	userId: string,
	audioSessionId: string | null,
	sfxSessionId: string | null,
	musicSessionId: string | null,
	sfxVolume: number,
	musicVolume: number,
	sfxStartTime: number,
	sfxEndTime: number,
	sfxFadeIn: number,
	sfxFadeOut: number,
	musicStartTime: number,
	musicEndTime: number,
	musicFadeIn: number,
	musicFadeOut: number,
	suppressOriginalAudio: boolean
) {
	const baseTemp = getTempBase();
	const sessionDir = path.join(baseTemp, `session-${sessionId}`);
	const silentOutputPath = path.join(baseTemp, `silent-${sessionId}.mp4`); // NEW — renamed
	const finalOutputPath = path.join(baseTemp, `output-${sessionId}.mp4`); // NEW — final (with or without audio)
	const audioPath = audioSessionId
		? path.join(baseTemp, 'audio', `audio-${audioSessionId}.aac`)
		: null;

	try {
		console.log(`🎬 Encoding ${totalFrames} frames from session ${sessionId}`);
		if (audioSessionId) {
			console.log(`🎵 Audio session found — will mux audio-${audioSessionId}.aac after encode`);
		}
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
		const audioDir = path.join(getTempBase(), 'audio');
		// ── PASS 1: Encode frames to silent MP4 ──────────────────────────────
		const encodeCommand = [
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
			`-y`,
			`"${silentOutputPath}"`
		].join(' ');

		console.log('🎬 Pass 1 — encoding frames to silent MP4...');
		await execAsync(encodeCommand, { maxBuffer: 50 * 1024 * 1024 });
		console.log('✅ Pass 1 complete — silent MP4 ready');

		// ── PASS 2: Mux audio back in (only if audio session exists) ─────────
		const audioFile = path.join(audioDir, `audio-${audioSessionId}.aac`);
		const sfxFile = path.join(audioDir, `sfx-${sfxSessionId}.mp3`);
		const musicFile = path.join(audioDir, `music-${musicSessionId}.mp3`);

		const hasAudio = audioSessionId && existsSync(audioFile);
		const hasSfx = sfxSessionId && existsSync(sfxFile);
		const hasMusic = musicSessionId && existsSync(musicFile);

		if (hasAudio || hasSfx || hasMusic) {
			console.log(`🎚️ Muxing audio — original:${hasAudio} sfx:${hasSfx} music:${hasMusic}`);

			const inputs: string[] = [`"${FFMPEG_PATH}" -i "${silentOutputPath}"`];
			let inputIndex = 1;

			// Track each audio stream: { label, volume, startTime, endTime, fadeIn, fadeOut }
			const streams: Array<{
				label: string;
				volume: number;
				startTime: number;
				endTime: number;
				fadeIn: number;
				fadeOut: number;
			}> = [];

			if (hasAudio && !suppressOriginalAudio) {
				inputs.push(`-i "${audioFile}"`);
				streams.push({
					label: `[${inputIndex}:a]`,
					volume: 1.0,
					startTime: 0,
					endTime: 999,
					fadeIn: 0,
					fadeOut: 0
				});
				inputIndex++;
			}
			if (hasSfx) {
				inputs.push(`-i "${sfxFile}"`);
				streams.push({
					label: `[${inputIndex}:a]`,
					volume: sfxVolume,
					startTime: sfxStartTime,
					endTime: sfxEndTime,
					fadeIn: sfxFadeIn,
					fadeOut: sfxFadeOut
				});
				inputIndex++;
			}
			if (hasMusic) {
				inputs.push(`-i "${musicFile}"`);
				streams.push({
					label: `[${inputIndex}:a]`,
					volume: musicVolume,
					startTime: musicStartTime,
					endTime: musicEndTime,
					fadeIn: musicFadeIn,
					fadeOut: musicFadeOut
				});
				inputIndex++;
			}

			// Build per-stream filter chains: trim → volume → afade in → afade out → label
			const filterParts: string[] = [];
			const mixLabels: string[] = [];

			streams.forEach((s, i) => {
				const outLabel = `[a${i}]`;
				const filters: string[] = [];

				const hasTrim = s.startTime > 0 || s.endTime < 999;
				const trimDuration = hasTrim ? s.endTime - s.startTime : null;

				// Trim to start/end window
				if (hasTrim) {
					filters.push(`atrim=start=${s.startTime}:end=${s.endTime}`);
					filters.push(`asetpts=PTS-STARTPTS`);
				}

				// Volume
				filters.push(`volume=${s.volume}`);

				// Fade in
				if (s.fadeIn > 0) {
					filters.push(`afade=t=in:st=0:d=${s.fadeIn}`);
				}

				// Fade out — only works reliably when we know the duration
				if (s.fadeOut > 0 && trimDuration !== null) {
					const fadeOutStart = Math.max(0, trimDuration - s.fadeOut);
					filters.push(`afade=t=out:st=${fadeOutStart}:d=${s.fadeOut}`);
				} else if (s.fadeOut > 0 && trimDuration === null) {
					// No trim — use areverse trick to apply fade out reliably
					filters.push(`areverse`);
					filters.push(`afade=t=in:st=0:d=${s.fadeOut}`);
					filters.push(`areverse`);
				}

				filterParts.push(`${s.label}${filters.join(',')}${outLabel}`);
				mixLabels.push(outLabel);
			});

			let audioArg: string;

			if (mixLabels.length === 1 && hasAudio && !hasSfx && !hasMusic) {
				// Only original audio, no effects — simple copy
				audioArg = `-map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k`;
			} else {
				// Mix all streams
				filterParts.push(
					`${mixLabels.join('')}amix=inputs=${mixLabels.length}:duration=longest[aout]`
				);
				const filterComplex = filterParts.join(';');
				audioArg = `-filter_complex "${filterComplex}" -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 192k`;
			}

			const muxCmd = [
				...inputs,
				audioArg,
				`-shortest`,
				`-movflags +faststart`,
				`-y`,
				`"${finalOutputPath}"`
			].join(' ');

			await execAsync(muxCmd, { maxBuffer: 500 * 1024 * 1024 });
			console.log('✅ Pass 2 complete — audio muxed');

			for (const f of [audioFile, sfxFile, musicFile]) {
				if (f && existsSync(f)) await unlink(f).catch(() => {});
			}
		} else {
			await rename(silentOutputPath, finalOutputPath);
			console.log('ℹ️ No audio — uploading silent video');
		}

		// ── end Pass 2 ──

		// ── UPLOAD TO GCS ────────────────────────────────────────────────────
		const videoBuffer = await readFile(finalOutputPath);
		const timestamp = Date.now();
		const fileName = `enhanced-video-${timestamp}.mp4`;

		const uploadResult = await uploadToGCS(userId, videoBuffer, fileName, 'video/mp4', 'videos');
		console.log(`☁️ Uploaded to GCS: ${uploadResult.publicUrl}`);

		// ── SAVE TO FIRESTORE ─────────────────────────────────────────────────
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

		// ── UPDATE USER STATS ─────────────────────────────────────────────────
		await updateUserStorage(userId, uploadResult.fileSize);
		await incrementContentStats(userId, 'video');

		// ── CLEANUP TEMP FILES ────────────────────────────────────────────────
		const files = await readdir(sessionDir).catch(() => []);
		for (const f of files) await unlink(path.join(sessionDir, f)).catch(() => {});
		await rmdir(sessionDir).catch(() => {});
		await unlink(finalOutputPath).catch(() => {});

		encodeJobs.set(sessionId, {
			status: 'complete',
			gcsUrl: uploadResult.publicUrl,
			createdAt: encodeJobs.get(sessionId)!.createdAt
		});

		console.log(`✅ Job ${sessionId} complete — saved to library for user ${userId}`);
	} catch (error) {
		console.error('❌ Encoding error:', error);

		// Cleanup on error
		if (existsSync(sessionDir)) {
			const files = await readdir(sessionDir).catch(() => []);
			for (const f of files) await unlink(path.join(sessionDir, f)).catch(() => {});
			await rmdir(sessionDir).catch(() => {});
		}
		if (existsSync(silentOutputPath)) await unlink(silentOutputPath).catch(() => {});
		if (existsSync(finalOutputPath)) await unlink(finalOutputPath).catch(() => {});

		// Clean up audio file on error too
		if (audioPath && existsSync(audioPath)) await unlink(audioPath).catch(() => {});

		encodeJobs.set(sessionId, {
			status: 'error',
			error: error instanceof Error ? error.message : String(error),
			createdAt: encodeJobs.get(sessionId)!.createdAt
		});
	}
}

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const {
		sessionId,
		totalFrames,
		fps,
		width,
		height,
		userId,
		audioSessionId,
		sfxSessionId,
		musicSessionId,
		sfxVolume = 0.4,
		musicVolume = 0.3,
		sfxStartTime = 0,
		sfxEndTime = 8,
		sfxFadeIn = 0,
		sfxFadeOut = 0,
		musicStartTime = 0,
		musicEndTime = 16,
		musicFadeIn = 0,
		musicFadeOut = 0,
		suppressOriginalAudio = false
	} = body; // UPDATED

	if (!userId) {
		return new Response(JSON.stringify({ error: 'Missing userId' }), { status: 400 });
	}

	pruneOldJobs();
	encodeJobs.set(sessionId, { status: 'processing', createdAt: Date.now() });

	// Pass audioSessionId through — will be null if no audio was preserved
	runEncode(
		sessionId,
		totalFrames,
		fps,
		width,
		height,
		userId,
		audioSessionId,
		sfxSessionId,
		musicSessionId,
		sfxVolume,
		musicVolume,
		sfxStartTime,
		sfxEndTime,
		sfxFadeIn,
		sfxFadeOut,
		musicStartTime,
		musicEndTime,
		musicFadeIn,
		musicFadeOut,
		suppressOriginalAudio
	);

	return new Response(JSON.stringify({ success: true, jobId: sessionId }), {
		headers: { 'Content-Type': 'application/json' }
	});
};
