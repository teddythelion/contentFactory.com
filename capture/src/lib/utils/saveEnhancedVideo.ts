// src/lib/utils/saveEnhancedVideo.ts
// Auto-saves enhanced videos to GCS and creates Firestore content record

import { adminDb } from '$lib/firebase/admin';
import { uploadToGCS } from '$lib/firebase/storage';
import { Timestamp } from 'firebase-admin/firestore';

export interface SaveEnhancedVideoResult {
  success: boolean;
  contentId: string;
  publicUrl: string;
  gcsPath: string;
  error?: string;
}

/**
 * Converts Base64 string to Buffer
 */
function base64ToBuffer(base64String: string): Buffer {
  // Remove data URI prefix if present (e.g., "data:video/webm;base64,")
  const base64Data = base64String.includes(',') 
    ? base64String.split(',')[1] 
    : base64String;
  
  return Buffer.from(base64Data, 'base64');
}

/**
 * Auto-saves enhanced video to GCS and creates Firestore record
 * Called after video capture completes
 */
export async function saveEnhancedVideo(
  userId: string,
  base64VideoData: string,
  originalContentId: string,
  format: string = 'webm'
): Promise<SaveEnhancedVideoResult> {
  try {
    // Convert Base64 to Buffer
    const videoBuffer = base64ToBuffer(base64VideoData);

    // Generate filename with enhanced prefix
    const timestamp = Date.now();
    const fileName = `enhanced-${originalContentId}-${timestamp}.${format}`;

    // Upload to GCS
    const uploadResult = await uploadToGCS(
      userId,
      videoBuffer,
      fileName,
      `video/${format}`,
      'videos'
    );

    // Create Firestore document for enhanced video
    const contentRef = adminDb.collection('content').doc();
    const contentId = contentRef.id;

    const contentData = {
      contentId,
      userId,
      type: 'video',
      status: 'enhanced',
      title: `Enhanced Video ${new Date().toLocaleDateString()}`,
      description: 'AI-enhanced video with 3D effects and overlays',
      gcsPath: uploadResult.gcsPath,
      publicUrl: uploadResult.publicUrl,
      thumbnailUrl: null,
      fileSize: uploadResult.fileSize,
      format,
      duration: null, // Will be set later if needed
      model: 'three-js-enhancement',
      generationTime: 0,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      tags: ['enhanced', '3d-effects'],
      category: null,
      timesPosted: 0,
      timesDownloaded: 0,
      isPinned: false,
      markedForDeletion: false,
      deletionScheduledFor: null,
      deletionWarningsSent: 0,
      isUsedInPost: false,
      originalContentId // Link back to original generated video
    };

    await contentRef.set(contentData);

    return {
      success: true,
      contentId,
      publicUrl: uploadResult.publicUrl,
      gcsPath: uploadResult.gcsPath
    };
  } catch (error) {
    console.error('Error saving enhanced video:', error);
    return {
      success: false,
      contentId: '',
      publicUrl: '',
      gcsPath: '',
      error: error instanceof Error ? error.message : 'Failed to save enhanced video'
    };
  }
}