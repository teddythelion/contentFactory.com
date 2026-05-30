import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/firebase/admin';
import { deleteFromGCS } from '$lib/firebase/storage';

export const DELETE: RequestHandler = async ({ request, locals }) => {
	try {
		const userId = locals.user?.uid;
		if (!userId) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { contentId } = await request.json();
		if (!contentId) {
			return json({ error: 'contentId required' }, { status: 400 });
		}

		// Get content doc to get GCS path
		const doc = await adminDb.collection('content').doc(contentId).get();
		if (!doc.exists) {
			return json({ error: 'Not found' }, { status: 404 });
		}

		const data = doc.data();
		if (data?.userId !== userId) {
			return json({ error: 'Unauthorized' }, { status: 403 });
		}

		// Delete from GCS
		if (data?.gcsPath) {
			await deleteFromGCS(data.gcsPath);
		}

		// Delete from Firestore
		await adminDb.collection('content').doc(contentId).delete();

		return json({ success: true });
	} catch (error: any) {
		console.error('Error deleting content:', error);
		return json({ error: error.message }, { status: 500 });
	}
};
