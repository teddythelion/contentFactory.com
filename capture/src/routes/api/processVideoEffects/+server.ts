// routes/api/processVideoEffects/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const execAsync = promisify(exec);

// FFmpeg path - check multiple locations
function getFFmpegPath(): string {
	// 1. Check environment variable
	if (process.env.FFMPEG_PATH) {
		return process.env.FFMPEG_PATH;
	}

	// 2. Check if @ffmpeg-installer/ffmpeg is installed
	try {
		const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
		if (ffmpegInstaller.path) {
			console.log('Using FFmpeg from @ffmpeg-installer/ffmpeg:', ffmpegInstaller.path);
			return ffmpegInstaller.path;
		}
	} catch {
		// Package not installed, continue
	}

	// 3. Check node_modules/.bin
	const nodeModulesBinPath = path.join(process.cwd(), 'node_modules', '.bin', 'ffmpeg');
	if (existsSync(nodeModulesBinPath)) {
		console.log('Using FFmpeg from node_modules/.bin');
		return nodeModulesBinPath;
	}

	// 4. Default to system PATH
	console.log('Using system FFmpeg (must be in PATH)');
	return 'ffmpeg';
}

const FFMPEG_PATH = getFFmpegPath();

interface VideoEffects {
	brightness: number;
	contrast: number;
	saturation: number;
	hue: number;
	blur: number;
	grayscale: number;
	sepia: number;
	invert: number;
	opacity: number;
}

export const POST: RequestHandler = async ({ request }) => {
	let tempInputPath: string | null = null;
	let tempOutputPath: string | null = null;
	let shouldCleanupInput = false; // Track if we should delete the input file

	try {
		const formData = await request.formData();
		const videoFile = formData.get('videoFile') as File | null;
		const videoUrl = formData.get('videoUrl') as string | null;
		const effectsJson = formData.get('effects') as string;

		if (!effectsJson) {
			return json({ error: 'Effects settings are required' }, { status: 400 });
		}

		const effects: VideoEffects = JSON.parse(effectsJson);

		// Create temp directory if it doesn't exist
		const tempDir = path.join(process.cwd(), 'temp');
		if (!existsSync(tempDir)) {
			await mkdir(tempDir, { recursive: true });
		}

		const uniqueId = randomUUID();
		tempOutputPath = path.join(tempDir, `output-${uniqueId}.webm`);

		// Determine input source
		if (videoFile) {
			// Scenario B: Uploaded video file
			console.log('📤 Processing uploaded video file');
			const fileExtension = videoFile.name.split('.').pop() || 'mp4';
			tempInputPath = path.join(tempDir, `input-${uniqueId}.${fileExtension}`);
			
			const arrayBuffer = await videoFile.arrayBuffer();
			await writeFile(tempInputPath, Buffer.from(arrayBuffer));
			shouldCleanupInput = true; // We created this temp file, so clean it up
		} else if (videoUrl) {
			// Scenario A: Video URL (generated or external)
			console.log('🔗 Processing video from URL:', videoUrl);
			
			if (videoUrl.startsWith('http')) {
				// External URL - download it first
				tempInputPath = path.join(tempDir, `input-${uniqueId}.mp4`);
				const response = await fetch(videoUrl);
				
				if (!response.ok) {
					throw new Error(`Failed to fetch video: ${response.statusText}`);
				}
				
				const arrayBuffer = await response.arrayBuffer();
				await writeFile(tempInputPath, Buffer.from(arrayBuffer));
				shouldCleanupInput = true; // We created this temp file, so clean it up
			} else {
				// Local file path - use directly
				tempInputPath = videoUrl;
				shouldCleanupInput = false; // Don't delete original file
			}
		} else {
			return json({ error: 'Either videoFile or videoUrl must be provided' }, { status: 400 });
		}

		// Build FFmpeg filter string
		const filters = buildFFmpegFilters(effects);
		
		console.log('🎬 Applying effects with FFmpeg...');
		console.log('Filters:', filters);

		// FFmpeg command - FIXED: Changed -c:a copy to -c:a libopus for WebM compatibility
		const ffmpegCommand = `"${FFMPEG_PATH}" -i "${tempInputPath}" -vf "${filters}" -c:v libvpx-vp9 -b:v 5M -c:a libopus "${tempOutputPath}"`;
		
		console.log('Executing:', ffmpegCommand);

		// Execute FFmpeg
		await execAsync(ffmpegCommand);
		console.log('✅ FFmpeg processing complete');

		// Read the processed video
		const processedVideo = await readFileAsBase64(tempOutputPath);

		// Clean up temp files
		if (shouldCleanupInput && tempInputPath) {
			await unlink(tempInputPath).catch((err) => console.error('Cleanup error:', err));
		}
		await unlink(tempOutputPath).catch((err) => console.error('Cleanup error:', err));

		return json({
			success: true,
			videoBase64: processedVideo,
			message: 'Video processed successfully'
		});

	} catch (error) {
		console.error('❌ Error processing video:', error);

		// Clean up on error
		if (shouldCleanupInput && tempInputPath) {
			await unlink(tempInputPath).catch(() => {});
		}
		if (tempOutputPath) {
			await unlink(tempOutputPath).catch(() => {});
		}

		return json(
			{ 
				error: 'Failed to process video', 
				details: error instanceof Error ? error.message : String(error) 
			},
			{ status: 500 }
		);
	}
};

function buildFFmpegFilters(effects: VideoEffects): string {
	const filters: string[] = [];

	// Brightness (0-200% -> -1 to 1 for FFmpeg)
	if (effects.brightness !== 100) {
		const value = (effects.brightness - 100) / 100; // Convert to -1 to 1
		filters.push(`eq=brightness=${value}`);
	}

	// Contrast (0-200% -> -1000 to 1000 for FFmpeg)
	if (effects.contrast !== 100) {
		const value = ((effects.contrast - 100) / 100) * 2; // Convert to -2 to 2
		filters.push(`eq=contrast=${value}`);
	}

	// Saturation (0-200% -> 0 to 3 for FFmpeg)
	if (effects.saturation !== 100) {
		const value = effects.saturation / 100; // Convert to 0 to 2
		filters.push(`eq=saturation=${value}`);
	}

	// Hue (0-360 degrees)
	if (effects.hue !== 0) {
		filters.push(`hue=h=${effects.hue}`);
	}

	// Blur (0-20px)
	if (effects.blur > 0) {
		filters.push(`boxblur=${effects.blur}:${effects.blur}`);
	}

	// Grayscale (0-100%)
	if (effects.grayscale > 0) {
		const value = effects.grayscale / 100;
		filters.push(`hue=s=${1 - value}`);
	}

	// Sepia (0-100%)
	if (effects.sepia > 0) {
		const intensity = effects.sepia / 100;
		filters.push(`colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131`);
		if (intensity < 1) {
			// Blend with original
			filters.push(`blend=all_expr='A*${intensity}+B*${1-intensity}'`);
		}
	}

	// Invert (0-100%)
	if (effects.invert > 0) {
		if (effects.invert >= 100) {
			filters.push(`negate`);
		} else {
			// Partial invert using curves
			const intensity = effects.invert / 100;
			filters.push(`curves=all='0/0 1/${1-intensity}'`);
		}
	}

	// Opacity (0-100%)
	if (effects.opacity !== 100) {
		const value = effects.opacity / 100;
		filters.push(`format=rgba,colorchannelmixer=aa=${value}`);
	}

	// Join all filters with comma
	return filters.length > 0 ? filters.join(',') : 'copy';
}

async function readFileAsBase64(filePath: string): Promise<string> {
	const buffer = await readFile(filePath);
	return buffer.toString('base64');
}