import { PUBLIC_GALLERY_API_URL } from '$env/static/public'
import { getStoredTokens } from '$lib/auth/client'

// Upload API Configuration
const UPLOAD_API_BASE_URL = PUBLIC_GALLERY_API_URL || 'https://your-gallery-api-id.execute-api.us-east-1.amazonaws.com/prod'

export interface UploadResult {
  success: boolean
  message: string
  data?: {
    filename: string
    media_type: 'pictures' | 'videos' | 'documents'
    s3_key: string
    file_size: number
    upload_time: string
    uploaded_by: string
  }
  error?: string
}

export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

// Supported file types
export const SUPPORTED_FILE_TYPES = {
  pictures: {
    extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'],
    mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'],
    maxSize: 50 * 1024 * 1024, // 50MB
  },
  videos: {
    extensions: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'],
    mimeTypes: ['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv', 'video/webm'],
    maxSize: 500 * 1024 * 1024, // 500MB
  },
  documents: {
    extensions: ['pdf', 'doc', 'docx', 'txt', 'rtf'],
    mimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/rtf'],
    maxSize: 50 * 1024 * 1024, // 50MB
  },
}

export function validateFile(file: File): { valid: boolean, message?: string, mediaType?: string } {
  // Check file size (general limit)
  const maxSize = 500 * 1024 * 1024 // 500MB general limit
  if (file.size > maxSize) {
    return {
      valid: false,
      message: `File size (${formatFileSize(file.size)}) exceeds maximum allowed size (${formatFileSize(maxSize)})`,
    }
  }

  // Check if file is empty
  if (file.size === 0) {
    return {
      valid: false,
      message: 'File is empty',
    }
  }

  // Determine media type and validate
  const mediaType = determineMediaType(file)
  if (!mediaType) {
    return {
      valid: false,
      message: `Unsupported file type: ${file.name}`,
    }
  }

  // Check specific media type limits
  const typeConfig = SUPPORTED_FILE_TYPES[mediaType]
  if (file.size > typeConfig.maxSize) {
    return {
      valid: false,
      message: `${mediaType} files cannot exceed ${formatFileSize(typeConfig.maxSize)}`,
    }
  }

  return {
    valid: true,
    mediaType,
  }
}

export function determineMediaType(file: File): 'pictures' | 'videos' | 'documents' | null {
  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  const mimeType = file.type.toLowerCase()

  for (const [mediaType, config] of Object.entries(SUPPORTED_FILE_TYPES)) {
    if (config.extensions.includes(extension) || config.mimeTypes.includes(mimeType)) {
      return mediaType as 'pictures' | 'videos' | 'documents'
    }
  }

  return null
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0)
    return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
}

export async function uploadMediaFile(
  file: File,
  onProgress?: (progress: UploadProgress) => void,
): Promise<UploadResult> {
  try {
    // Validate file
    const validation = validateFile(file)
    if (!validation.valid) {
      return {
        success: false,
        message: validation.message || 'File validation failed',
      }
    }

    // Get authentication token
    const tokens = getStoredTokens()
    if (!tokens?.idToken) {
      return {
        success: false,
        message: 'Authentication required. Please log in.',
        error: 'NO_AUTH_TOKEN',
      }
    }

    // Convert file to base64 for JSON upload
    const fileData = await fileToBase64(file)

    // Prepare upload payload
    const uploadPayload = {
      filename: file.name,
      file_data: fileData,
      content_type: file.type || 'application/octet-stream',
    }

    // Create XMLHttpRequest for progress tracking
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest()

      // Track upload progress
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress: UploadProgress = {
            loaded: event.loaded,
            total: event.total,
            percentage: Math.round((event.loaded / event.total) * 100),
          }
          onProgress(progress)
        }
      })

      // Handle response
      xhr.addEventListener('load', () => {
        try {
          const response = JSON.parse(xhr.responseText)

          if (xhr.status === 200 && response.success) {
            resolve({
              success: true,
              message: response.message,
              data: response.data,
            })
          }
          else {
            resolve({
              success: false,
              message: response.message || `Upload failed with status ${xhr.status}`,
              error: response.error,
            })
          }
        }
        catch {
          resolve({
            success: false,
            message: 'Failed to parse server response',
            error: 'PARSE_ERROR',
          })
        }
      })

      // Handle errors
      xhr.addEventListener('error', () => {
        resolve({
          success: false,
          message: 'Network error during upload',
          error: 'NETWORK_ERROR',
        })
      })

      xhr.addEventListener('timeout', () => {
        resolve({
          success: false,
          message: 'Upload timed out',
          error: 'TIMEOUT',
        })
      })

      // Configure and send request
      xhr.open('POST', `${UPLOAD_API_BASE_URL}/upload`)
      xhr.setRequestHeader('Content-Type', 'application/json')
      xhr.setRequestHeader('Authorization', `Bearer ${tokens.idToken}`)
      xhr.timeout = 300000 // 5 minutes timeout

      xhr.send(JSON.stringify(uploadPayload))
    })
  }
  catch (error) {
    console.error('Upload error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Upload failed',
      error: 'UNKNOWN_ERROR',
    }
  }
}

export async function uploadMultipleFiles(
  files: File[],
  onFileProgress?: (fileIndex: number, progress: UploadProgress) => void,
  onFileComplete?: (fileIndex: number, result: UploadResult) => void,
): Promise<UploadResult[]> {
  const results: UploadResult[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]

    const result = await uploadMediaFile(file, (progress) => {
      if (onFileProgress) {
        onFileProgress(i, progress)
      }
    })

    results.push(result)

    if (onFileComplete) {
      onFileComplete(i, result)
    }

    // Small delay between uploads to prevent overwhelming the server
    if (i < files.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  return results
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Remove data URL prefix (data:mime/type;base64,)
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function getUploadStats(results: UploadResult[]) {
  const successful = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length
  const totalSize = results
    .filter(r => r.success && r.data)
    .reduce((sum, r) => sum + (r.data?.file_size || 0), 0)

  return {
    total: results.length,
    successful,
    failed,
    totalSize: formatFileSize(totalSize),
    successRate: results.length > 0 ? Math.round((successful / results.length) * 100) : 0,
  }
}
