import { authStore } from '$lib/auth/auth-store';
import { get } from 'svelte/store';
import { PUBLIC_API_GATEWAY_URL } from '$env/static/public';
import { refreshSession } from '$lib/auth/client';

export async function downloadSourcePdf(): Promise<void> {
  const currentUrl = new URL(window.location.href);
  const sanitizedTitle = decodeURIComponent(currentUrl.pathname);

  try {
    const auth = get(authStore);
    if (!auth.isAuthenticated || !auth.tokens) {
      throw new Error('Authentication required. Please log in.');
    }

    // Try to refresh the token before making the request
    try {
      await refreshSession();
    } catch (refreshError) {
      console.warn('Token refresh failed:', refreshError);
      // Continue with existing token
    }

    // Get the latest token state after potential refresh
    const currentAuth = get(authStore);
    if (!currentAuth.isAuthenticated || !currentAuth.tokens) {
      throw new Error('Authentication required. Please log in.');
    }

    console.log('Making PDF download request:', {
      url: `${PUBLIC_API_GATEWAY_URL}/pdf-download`,
      method: 'POST',
      key: sanitizedTitle,
      hasToken: !!currentAuth.tokens.idToken
    });

    const response = await fetch(`${PUBLIC_API_GATEWAY_URL}/pdf-download`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${currentAuth.tokens.idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        key: sanitizedTitle
      })
    });

    console.log('PDF download response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('PDF download error response:', errorText);
      
      // If token expired even after refresh, redirect to login
      if (response.status === 401) {
        authStore.clearAuth();
        window.location.href = '/auth/login';
        return;
      }
      
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.json();
    const data = JSON.parse(responseData.body);
    
    // Open in new tab to force download
    window.open(data.url, '_blank');

  } catch (error) {
    console.error("Error downloading PDF:", error);
    throw error;
  }
}

export async function getMarkdownContent(path: string): Promise<string> {
  const currentUrl = new URL(window.location.href);
  const sanitizedTitle = decodeURIComponent(currentUrl.pathname);

  try {
    const auth = get(authStore);
    if (!auth.isAuthenticated || !auth.tokens) {
      throw new Error('User is not authenticated');
    }

    // Try to refresh the token before making the request
    try {
      await refreshSession();
    } catch (refreshError) {
      console.warn('Token refresh failed:', refreshError);
      // Continue with existing token
    }

    // Get the latest token state after potential refresh
    const currentAuth = get(authStore);
    if (!currentAuth.isAuthenticated || !currentAuth.tokens) {
      throw new Error('User is not authenticated');
    }

    const payload = {
      type: "downloadMD",
      title: sanitizedTitle,
    };

    const response = await fetch(`${PUBLIC_API_GATEWAY_URL}/markdown`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${currentAuth.tokens.idToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      // If token expired even after refresh, redirect to login
      if (response.status === 401) {
        authStore.clearAuth();
        window.location.href = '/auth/login';
        return;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseData = await response.json();
    
    if (!responseData.downloadUrl) {
      throw new Error('Failed to load markdown file');
    }

    return responseData.downloadUrl;
  } catch (error) {
    console.error('Error loading markdown content:', error);
    throw error;
  }
}

export async function saveMarkdownContent(content: string): Promise<boolean> {
  const currentUrl = new URL(window.location.href);
  const sanitizedTitle = decodeURIComponent(currentUrl.pathname);

  try {
    const auth = get(authStore);
    if (!auth.isAuthenticated || !auth.tokens) {
      throw new Error('User is not authenticated');
    }

    // Try to refresh the token before making the request
    try {
      await refreshSession();
    } catch (refreshError) {
      console.warn('Token refresh failed:', refreshError);
      // Continue with existing token
    }

    // Get the latest token state after potential refresh
    const currentAuth = get(authStore);
    if (!currentAuth.isAuthenticated || !currentAuth.tokens) {
      throw new Error('User is not authenticated');
    }

    const payload = {
      type: "update",
      title: sanitizedTitle,
      content: content,
    };

    const response = await fetch(`${PUBLIC_API_GATEWAY_URL}/markdown`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${currentAuth.tokens.idToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      // If token expired even after refresh, redirect to login
      if (response.status === 401) {
        authStore.clearAuth();
        window.location.href = '/auth/login';
        return false;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error('Error saving markdown content:', error);
    throw error;
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = reader.result as string;
      const base64Content = base64String.split(',')[1];
      resolve(base64Content);
    };
    reader.onerror = error => reject(error);
  });
}

export async function addLetterLambda(files: File | File[]): Promise<string> {
  try {
    const auth = get(authStore);
    if (!auth.isAuthenticated || !auth.tokens) {
      throw new Error('User is not authenticated');
    }

    // Try to refresh the token before making the request
    try {
      await refreshSession();
    } catch (refreshError) {
      console.warn('Token refresh failed:', refreshError);
      // Continue with existing token
    }

    // Get the latest token state after potential refresh
    const currentAuth = get(authStore);
    if (!currentAuth.isAuthenticated || !currentAuth.tokens) {
      throw new Error('User is not authenticated');
    }

    const filesArray = Array.isArray(files) ? files : [files];

    const filePromises = filesArray.map(async (file) => {
      const base64 = await fileToBase64(file);
      return {
        fileName: file.name,
        contentType: file.type,
        fileData: base64,
        size: Math.round(file.size / 1024)
      };
    });

    const fileData = await Promise.all(filePromises);

    const payload = {
      type: "create",
      files: fileData
    };

    const response = await fetch(`${PUBLIC_API_GATEWAY_URL}/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${currentAuth.tokens.idToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      // If token expired even after refresh, redirect to login
      if (response.status === 401) {
        authStore.clearAuth();
        window.location.href = '/auth/login';
        return 'Authentication expired';
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseData = await response.json();
    return responseData.message || 'Upload successful';
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
}
