import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/firebase/admin';
import admin from 'firebase-admin';

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		const userId = url.searchParams.get('userId');
		if (!userId) {
			return json({ error: 'userId required' }, { status: 400 });
		}

		const snapshot = await adminDb
			.collection('content')
			.where('userId', '==', userId)
			.orderBy('createdAt', 'desc')
			.get();

		const bucket = admin.storage().bucket('project_app_bucket');
		const items = [];

		for (const doc of snapshot.docs) {
			const data = doc.data();
			const filePath = data.gcsPath.replace('gs://project_app_bucket/', '');

			try {
				// Generate signed URL (valid for 7 days)
				const [signedUrl] = await bucket.file(filePath).getSignedUrl({
					version: 'v4',
					action: 'read',
					expires: Date.now() + 7 * 24 * 60 * 60 * 1000
				});

				items.push({
					...data,
					contentId: doc.id,
					publicUrl: signedUrl
				});
			} catch (err) {
				console.error('Error generating signed URL:', err);
				// Skip this item if signed URL fails
			}
		}

		return json({ items });
	} catch (error: any) {
		console.error('Error fetching content:', error);
		return json({ error: error.message }, { status: 500 });
	}
};
