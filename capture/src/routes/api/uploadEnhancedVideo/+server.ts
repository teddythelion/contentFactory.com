import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/firebase/admin';
import { uploadToGCS, updateUserStorage, incrementContentStats } from '$lib/firebase/storage';
import { Timestamp } from 'firebase-admin/firestore';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const userId = locals.user?.uid;
		if (!userId) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Get video blob from FormData
		const formData = await request.formData();
		const file = formData.get('file') as File;

		if (!file) {
			return json({ error: 'No video file provided' }, { status: 400 });
		}

		const fileBuffer = Buffer.from(await file.arrayBuffer());
		const timestamp = Date.now();
		const fileName = `enhanced-video-${timestamp}.mp4`;

		// Upload to GCS using your existing helper
		const uploadResult = await uploadToGCS(
			userId,
			fileBuffer,
			fileName,
			'video/mp4',
			'videos'
		);

		// Create Firestore document
		const contentRef = adminDb.collection('content').doc();
		const contentId = contentRef.id;

		const contentData = {
			contentId,
			userId,
			type: 'video',
			title: `Enhanced Video ${timestamp}`,
			description: 'Three.js enhanced video',
			prompt: '',
			gcsPath: uploadResult.gcsPath,
			publicUrl: uploadResult.publicUrl,
			thumbnailUrl: null,
			width: 1080,
			height: 1080,
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
		};

		await contentRef.set(contentData);

		// Update user stats
		await updateUserStorage(userId, uploadResult.fileSize);
		await incrementContentStats(userId, 'video');

		console.log(`✅ Enhanced video saved to GCS: ${uploadResult.publicUrl}`);

		return json({
			success: true,
			contentId,
			publicUrl: uploadResult.publicUrl
		});
	} catch (error: any) {
		console.error('Error uploading enhanced video:', error);
		return json(
			{
				error: error.message || 'Failed to upload enhanced video'
			},
			{ status: 500 }
		);
	}
};