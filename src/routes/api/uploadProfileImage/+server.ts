import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { uploadToGCS } from '$lib/firebase/storage';
import { adminDb, adminAuth } from '$lib/firebase/admin';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export const POST: RequestHandler = async ({ request, locals }) => {
	const userId = locals.user?.uid;
	if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

	const formData = await request.formData();
	const file = formData.get('image') as File | null;

	if (!file) return json({ error: 'No image provided' }, { status: 400 });
	if (!ALLOWED_TYPES.includes(file.type)) return json({ error: 'Invalid file type. Use JPEG, PNG, WebP, or GIF.' }, { status: 400 });
	if (file.size > MAX_SIZE) return json({ error: 'Image must be under 10MB.' }, { status: 400 });

	const ext = file.type.split('/')[1].replace('jpeg', 'jpg');
	const fileName = `profileImage.${ext}`;

	const buffer = Buffer.from(await file.arrayBuffer());
	const { publicUrl } = await uploadToGCS(userId, buffer, fileName, file.type, 'profile');

	// Update Firestore
	await adminDb.collection('users').doc(userId).update({ photoURL: publicUrl });

	// Update Firebase Auth profile
	await adminAuth.updateUser(userId, { photoURL: publicUrl });

	return json({ photoURL: publicUrl });
};
