import { authStore } from '$lib/auth/auth-store';
import { get } from 'svelte/store';
import { PUBLIC_API_GATEWAY_URL } from '$env/static/public';

export interface MediaItem {
  id: string;
  filename: string;
  title: string;
  description?: string;
  uploadDate: string;
  fileSize: number;
  contentType: string;
  thumbnailUrl?: string;
  signedUrl: string;
  category: 'pictures' | 'videos' | 'documents';
}

export async function uploadMedia(file: File): Promise<MediaItem> {
  const auth = get(authStore);
  if (!auth.isAuthenticated || !auth.tokens) {
    throw new Error('User is not authenticated');
  }

  // Create FormData with the file
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${PUBLIC_API_GATEWAY_URL}/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${auth.tokens.idToken}`
    },
    body: formData
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Upload failed');
  }

  const result = await response.json();
  
  // Convert the Lambda response to a MediaItem
  return {
    id: result.key,
    filename: result.filename,
    title: result.filename,
    uploadDate: new Date().toISOString(),
    fileSize: result.size,
    contentType: result.contentType,
    signedUrl: result.url,
    category: determineCategory(result.contentType)
  };
}

export async function getMediaItems(category: 'pictures' | 'videos' | 'documents'): Promise<MediaItem[]> {
  const auth = get(authStore);
  if (!auth.isAuthenticated || !auth.tokens) {
    throw new Error('User is not authenticated');
  }

  const response = await fetch(`${PUBLIC_API_GATEWAY_URL}/media/${category}`, {
    headers: {
      'Authorization': `Bearer ${auth.tokens.idToken}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || `Failed to load ${category}`);
  }

  return response.json();
}

function determineCategory(contentType: string): 'pictures' | 'videos' | 'documents' {
  if (contentType.startsWith('image/')) {
    return 'pictures';
  } else if (contentType.startsWith('video/')) {
    return 'videos';
  }
  return 'documents';
}
