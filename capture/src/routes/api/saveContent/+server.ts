// src/routes/api/saveContent/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/firebase/admin';
import { uploadToGCS } from '$lib/firebase/storage';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

interface SaveContentParams {
	fileUrl: string;
	type: 'image' | 'video';
	title?: string;
	description?: string;
	prompt?: string;
	width?: number;
	height?: number;
	format: string;
	duration?: number;
	model?: string;
	generationTime?: number;
	tags?: string[];
}

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const userId = locals.user?.uid;
		if (!userId) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const params: SaveContentParams = await request.json();

		if (!params.fileUrl) {
			return json({ error: 'No file URL provided' }, { status: 400 });
		}

		// Extract base64 from data URL or fetch from HTTP URL
		let imageBuffer: Buffer;
		let fileSize: number;

		if (params.fileUrl.startsWith('data:')) {
			// Handle data URL (base64)
			const base64Data = params.fileUrl.split(',')[1];
			imageBuffer = Buffer.from(base64Data, 'base64');
			fileSize = imageBuffer.length;
		} else {
			// Handle HTTP URL - fetch and convert
			const response = await fetch(params.fileUrl);
			const arrayBuffer = await response.arrayBuffer();
			imageBuffer = Buffer.from(arrayBuffer);
			fileSize = imageBuffer.length;
		}

		// Upload to GCS
		const fileName = `${params.type}-${Date.now()}.${params.format || 'png'}`;
		const uploadResult = await uploadToGCS(
			userId,
			imageBuffer,
			fileName,
			params.type === 'image' ? 'image/png' : 'video/mp4',
			params.type === 'image' ? 'images' : 'videos'
		);

		// Save metadata to Firestore
		const contentRef = adminDb.collection('content').doc();
		const contentId = contentRef.id;

		const documentData: any = {
			contentId,
			userId,
			type: params.type,
			title:
				params.title ||
				`${params.type === 'image' ? 'Generated Image' : 'Generated Video'} ${new Date().toLocaleDateString()}`,
			description: params.description || '',
			prompt: params.prompt || '',
			gcsPath: uploadResult.gcsPath,
			publicUrl: uploadResult.publicUrl,
			format: params.format,
			model: params.model || 'gpt-image-1.5',
			generationTime: params.generationTime || 0,
			tags: params.tags || [],
			createdAt: Timestamp.now(),
			fileSize: fileSize,
			status: 'ready'
		};

		// Only add optional fields if defined
		if (params.width !== undefined) documentData.width = params.width;
		if (params.height !== undefined) documentData.height = params.height;
		if (params.duration !== undefined) documentData.duration = params.duration;

		await contentRef.set(documentData);

		// Update user stats
		await adminDb
			.collection('users')
			.doc(userId)
			.update({
				[params.type === 'image' ? 'imagesGenerated' : 'videosGenerated']: FieldValue.increment(1)
			})
			.catch(() => {
				// User doc might not exist yet, ignore
			});

		return json({
			success: true,
			contentId,
			publicUrl: uploadResult.publicUrl,
			message: `✅ ${params.type === 'image' ? 'Image' : 'Video'} saved to library!`
		});
	} catch (error: any) {
		console.error('Error saving content:', error);
		return json({ error: error.message || 'Failed to save content' }, { status: 500 });
	}
};
