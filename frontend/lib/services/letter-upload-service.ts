import { PUBLIC_API_GATEWAY_URL } from '$env/static/public'
import { getStoredTokens } from '$lib/auth/client'

const API_URL = PUBLIC_API_GATEWAY_URL?.replace(/\/+$/, '') || ''

export interface PresignedUrlInfo {
  url: string
  key: string
  index: number
}

export interface UploadRequestResponse {
  uploadId: string
  urls: PresignedUrlInfo[]
}

export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

export interface FileUploadState {
  file: File
  progress: UploadProgress
  status: 'pending' | 'uploading' | 'complete' | 'error'
  error?: string
}

// Supported file types for letter uploads
export const LETTER_FILE_TYPES = {
  extensions: ['pdf', 'jpg', 'jpeg', 'png'],
  mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
  maxSize: 50 * 1024 * 1024, // 50MB
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `Request failed: ${response.status} ${response.statusText}`)
  }
  return response.json()
}

/**
 * Get auth token or throw
 */
function getAuthToken(): string {
  const tokens = getStoredTokens()
  if (!tokens?.idToken) {
    throw new Error('Authentication required. Please log in.')
  }
  return tokens.idToken
}

/**
 * Validate a file for letter upload
 */
export function validateLetterFile(file: File): { valid: boolean, message?: string } {
  if (file.size === 0) {
    return { valid: false, message: 'File is empty' }
  }

  if (file.size > LETTER_FILE_TYPES.maxSize) {
    return { valid: false, message: `File size exceeds ${formatFileSize(LETTER_FILE_TYPES.maxSize)}` }
  }

  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  const mimeType = file.type.toLowerCase()

  const validExtension = LETTER_FILE_TYPES.extensions.includes(extension)
  const validMime = LETTER_FILE_TYPES.mimeTypes.includes(mimeType)

  if (!validExtension && !validMime) {
    return { valid: false, message: `Unsupported file type. Allowed: ${LETTER_FILE_TYPES.extensions.join(', ')}` }
  }

  return { valid: true }
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0)
    return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
}

/**
 * Request presigned URLs for uploading letter files
 */
export async function requestUploadUrls(files: File[]): Promise<UploadRequestResponse> {
  const authToken = getAuthToken()

  const response = await fetch(`${API_URL}/letters/upload-request`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileCount: files.length,
      fileTypes: files.map(f => f.type || 'application/pdf'),
    }),
  })

  return handleResponse<UploadRequestResponse>(response)
}

/**
 * Upload a single file to S3 using a presigned URL
 */
export async function uploadFileToS3(
  file: File,
  presignedUrl: string,
  onProgress?: (progress: UploadProgress) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress({
          loaded: event.loaded,
          total: event.total,
          percentage: Math.round((event.loaded / event.total) * 100),
        })
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      }
      else {
        reject(new Error(`Upload failed with status ${xhr.status}`))
      }
    })

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'))
    })

    xhr.addEventListener('timeout', () => {
      reject(new Error('Upload timed out'))
    })

    xhr.open('PUT', presignedUrl)
    xhr.setRequestHeader('Content-Type', file.type || 'application/pdf')
    xhr.timeout = 300000 // 5 minutes
    xhr.send(file)
  })
}

/**
 * Trigger backend processing after files are uploaded
 */
export async function triggerProcessing(uploadId: string): Promise<{ message: string }> {
  const authToken = getAuthToken()

  const response = await fetch(`${API_URL}/letters/process/${uploadId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  })

  return handleResponse<{ message: string }>(response)
}

/**
 * Upload multiple letter files and trigger processing
 */
export async function uploadLetterFiles(
  files: File[],
  onFileProgress?: (fileIndex: number, progress: UploadProgress) => void,
  onFileComplete?: (fileIndex: number) => void,
  onFileError?: (fileIndex: number, error: string) => void,
): Promise<{ uploadId: string, success: boolean, errors: string[] }> {
  const errors: string[] = []

  // Validate all files first
  for (const file of files) {
    const validation = validateLetterFile(file)
    if (!validation.valid) {
      throw new Error(`${file.name}: ${validation.message}`)
    }
  }

  // Get presigned URLs
  const { uploadId, urls } = await requestUploadUrls(files)

  // Upload each file to S3
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const urlInfo = urls[i]

    try {
      await uploadFileToS3(file, urlInfo.url, (progress) => {
        onFileProgress?.(i, progress)
      })
      onFileComplete?.(i)
    }
    catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Upload failed'
      errors.push(`${file.name}: ${errorMsg}`)
      onFileError?.(i, errorMsg)
    }
  }

  // Only trigger processing if all uploads succeeded
  if (errors.length === 0) {
    await triggerProcessing(uploadId)
  }

  return { uploadId, success: errors.length === 0, errors }
}
