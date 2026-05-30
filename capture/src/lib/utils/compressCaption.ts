// src/lib/utils/compressCaption.ts
// Uses Claude to intelligently compress captions to 280 chars while preserving meaning

export interface CompressionResult {
	original: string;
	compressed: string;
	charCount: number;
	wasCompressed: boolean;
}

/**
 * Compress caption to 280 characters using AI
 * If already under 280 chars, returns as-is
 */
export async function compressCaption(caption: string): Promise<CompressionResult> {
	const maxChars = 280;

	// Already short enough
	if (caption.length <= maxChars) {
		return {
			original: caption,
			compressed: caption,
			charCount: caption.length,
			wasCompressed: false
		};
	}

	try {
		const response = await fetch('/api/compress/caption', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				caption,
				maxChars
			})
		});

		if (!response.ok) {
			// Fallback: just truncate if AI fails
			return {
				original: caption,
				compressed: caption.substring(0, maxChars - 3) + '...',
				charCount: maxChars,
				wasCompressed: true
			};
		}

		const data = await response.json();

		return {
			original: caption,
			compressed: data.compressed,
			charCount: data.compressed.length,
			wasCompressed: true
		};
	} catch (error) {
		console.error('Error compressing caption:', error);
		// Fallback to simple truncation
		return {
			original: caption,
			compressed: caption.substring(0, maxChars - 3) + '...',
			charCount: maxChars,
			wasCompressed: true
		};
	}
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
	if (bytes === 0) return '0 Bytes';
	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Validate if content meets platform requirements
 */
export function validateContent(
	contentType: 'image' | 'video',
	fileSize: number
): {
	valid: boolean;
	message?: string;
	needsCompression?: boolean;
} {
	const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
	const MAX_IMAGE_SIZE = 8 * 1024 * 1024; // 8MB

	const maxSize = contentType === 'video' ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;

	if (fileSize > maxSize) {
		return {
			valid: false,
			message: `${contentType === 'video' ? 'Video' : 'Image'} exceeds ${formatFileSize(maxSize)} limit`,
			needsCompression: true
		};
	}

	return { valid: true };
}