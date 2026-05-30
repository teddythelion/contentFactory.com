import { auth } from '$lib/firebase/client';

export interface SaveContentParams {
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

export async function saveContentToCloud(params: SaveContentParams): Promise<{ success: boolean; contentId?: string; error?: string }> {
  try {
    // Get current user's auth token
    const user = auth.currentUser;
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const token = await user.getIdToken();

    // Call save API
    const response = await fetch('/api/saveContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(params)
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to save content' };
    }

    return {
      success: true,
      contentId: data.contentId
    };

  } catch (error: any) {
    console.error('Error saving content:', error);
    return { success: false, error: error.message || 'Failed to save content' };
  }
}