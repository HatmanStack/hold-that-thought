import { PUBLIC_API_GATEWAY_URL } from '$env/static/public'

// Gallery API Gateway Configuration
const GALLERY_API_BASE_URL = PUBLIC_API_GATEWAY_URL || 'https://your-gallery-api-id.execute-api.us-east-1.amazonaws.com/prod'

export interface GalleryItem {
  id: string
  filename: string
  title: string
  description?: string
  uploadDate: string
  fileSize: number
  contentType: string
  thumbnailUrl?: string
  signedUrl: string
  category: 'pictures' | 'videos' | 'documents'
}

// Get gallery items by calling API Gateway endpoint
export async function getGalleryItems(
  category: 'pictures' | 'videos' | 'documents',
  userId: string,
  authToken: string,
): Promise<GalleryItem[]> {
  try {
    const response = await fetch(`${GALLERY_API_BASE_URL}/gallery/${category}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Failed to fetch ${category}: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return data.items || []
  }
  catch (error) {
    console.error(`Error fetching ${category} from API Gateway:`, error)
    throw new Error(`Failed to load ${category} from gallery: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Health check function to verify API Gateway connection
export async function checkAPIGatewayConnection(authToken: string): Promise<boolean> {
  try {
    const response = await fetch(`${GALLERY_API_BASE_URL}/gallery/health`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    })

    return response.ok
  }
  catch (error) {
    console.error('API Gateway connection check failed:', error)
    return false
  }
}

// Download letter function using API Gateway
export async function downloadLetter(title: string, authToken: string): Promise<{ downloadUrl: string, fileNameSuggestion: string }> {
  try {
    const encodedTitle = encodeURIComponent(title)
    const response = await fetch(`${GALLERY_API_BASE_URL}/gallery/letters/${encodedTitle}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Failed to get download URL: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    if (!data.downloadUrl) {
      throw new Error('No download URL received from server')
    }

    return {
      downloadUrl: data.downloadUrl,
      fileNameSuggestion: data.fileNameSuggestion || `${title}.pdf`,
    }
  }
  catch (error) {
    console.error('Error downloading letter:', error)
    throw new Error(`Failed to download letter: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
