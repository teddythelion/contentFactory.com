import { Storage } from '@google-cloud/storage';
import { env } from '$env/dynamic/private';
import { adminDb } from '$lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { TIER_CONFIG } from '$lib/types/subscription';
import { getUserPlan } from '$lib/services/usage.service';

// Initialize Google Cloud Storage using service account path from env
const storage = new Storage({
	keyFilename: env.SERVICE_ACCOUNT_PATH || './service-account.json'
});

const BUCKET_NAME = env.GOOGLE_STORAGE_BUCKET || 'project_app_bucket';
const bucket = storage.bucket(BUCKET_NAME);

export interface UploadResult {
	gcsPath: string;
	publicUrl: string;
	fileSize: number;
}

/**
 * Upload file buffer to GCS with user-specific path
 */
export async function uploadToGCS(
	userId: string,
	file: Buffer,
	fileName: string,
	contentType: string,
	folder: 'images' | 'videos' | 'thumbnails' | 'profile' | 'audio'
): Promise<UploadResult> {
	const filePath = `users/${userId}/${folder}/${fileName}`;
	const fileRef = bucket.file(filePath);

	await fileRef.save(file, {
		contentType,
		metadata: {
			cacheControl: 'public, max-age=31536000'
		}
	});

	// Don't call makePublic() - bucket has uniform access enabled
	// Configure bucket IAM instead

	const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${filePath}`;
	const gcsPath = `gs://${BUCKET_NAME}/${filePath}`;

	return {
		gcsPath,
		publicUrl,
		fileSize: file.length
	};
}

/**
 * Delete file from GCS
 */
export async function deleteFromGCS(gcsPath: string): Promise<void> {
	const filePath = gcsPath.replace(`gs://${BUCKET_NAME}/`, '');
	const fileRef = bucket.file(filePath);

	try {
		await fileRef.delete();
	} catch (error) {
		console.error('Error deleting file from GCS:', error);
		// Don't throw - file might already be deleted
	}
}

export interface StorageCapCheck {
	allowed: boolean;
	used: number;
	limit: number;
}

/**
 * Hard cap on library storage. The limit always derives from TIER_CONFIG
 * (single source of truth) — the user doc's storageLimit field is display-only.
 */
export async function checkStorageCap(userId: string, incomingBytes: number): Promise<StorageCapCheck> {
	const [plan, userDoc] = await Promise.all([
		getUserPlan(userId),
		adminDb.collection('users').doc(userId).get()
	]);
	const limit = TIER_CONFIG[plan].storageLimit;
	const used = (userDoc.data()?.storageUsed as number | undefined) ?? 0;
	return { allowed: used + incomingBytes <= limit, used, limit };
}

export function storageCapMessage(cap: StorageCapCheck): string {
	const gb = (n: number) => (n / 1073741824).toFixed(2);
	return `Storage limit reached (${gb(cap.used)} GB of ${gb(cap.limit)} GB used) — delete items from your library or upgrade your plan.`;
}

/**
 * Update user storage usage in Firestore
 */
export async function updateUserStorage(userId: string, bytesAdded: number): Promise<void> {
	const userRef = adminDb.collection('users').doc(userId);
	await userRef.update({
		storageUsed: FieldValue.increment(bytesAdded)
	});
}

/**
 * Free storage on content delete — clamped at 0 because historical uploads
 * weren't all counted upward; a plain decrement could go negative.
 */
export async function decrementUserStorage(userId: string, bytesRemoved: number): Promise<void> {
	const userRef = adminDb.collection('users').doc(userId);
	await adminDb.runTransaction(async (tx) => {
		const snap = await tx.get(userRef);
		if (!snap.exists) return;
		const current = (snap.data()?.storageUsed as number | undefined) ?? 0;
		tx.update(userRef, { storageUsed: Math.max(0, current - bytesRemoved) });
	});
}

/**
 * Update user content generation stats
 */
export async function incrementContentStats(
	userId: string,
	type: 'image' | 'video'
): Promise<void> {
	const userRef = adminDb.collection('users').doc(userId);

	if (type === 'image') {
		await userRef.update({
			imagesGenerated: FieldValue.increment(1)
		});
	} else {
		await userRef.update({
			videosGenerated: FieldValue.increment(1)
		});
	}
}
