import { Storage } from '@google-cloud/storage';
import { env } from '$env/dynamic/private';
import { adminDb } from '$lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

// Initialize Google Cloud Storage using service account path from env
const storage = new Storage({
	keyFilename: env.SERVICE_ACCOUNT_PATH
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
	folder: 'images' | 'videos' | 'thumbnails'
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
