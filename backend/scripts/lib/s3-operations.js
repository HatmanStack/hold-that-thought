/**
 * S3 Operations for Letter Migration
 * Utilities for listing, copying, and uploading files to S3.
 */

import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  CopyObjectCommand,
  PutObjectCommand
} from '@aws-sdk/client-s3'

// S3 client configuration - uses default credentials from environment
const s3Client = new S3Client({})

/**
 * Convert a readable stream to string
 * @param {ReadableStream} stream - The readable stream
 * @returns {Promise<string>} The string content
 */
async function streamToString(stream) {
  const chunks = []
  for await (const chunk of stream) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf-8')
}

/**
 * List all letter folders under a given prefix
 *
 * @param {string} bucket - S3 bucket name
 * @param {string} prefix - Prefix to list under (e.g., 'urara/')
 * @returns {Promise<string[]>} Array of folder paths
 */
export async function listLetterFolders(bucket, prefix) {
  const folders = []
  let continuationToken = undefined

  do {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      Delimiter: '/',
      ContinuationToken: continuationToken
    })

    const response = await s3Client.send(command)

    if (response.CommonPrefixes) {
      for (const cp of response.CommonPrefixes) {
        if (cp.Prefix) {
          folders.push(cp.Prefix)
        }
      }
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined
  } while (continuationToken)

  return folders
}

/**
 * Get markdown and PDF files from a letter folder
 *
 * @param {string} bucket - S3 bucket name
 * @param {string} folderPath - Full folder path (e.g., 'urara/Family Letter/')
 * @returns {Promise<{markdown: string|null, pdfKey: string|null, folderName: string}>}
 */
export async function getLetterFiles(bucket, folderPath) {
  // List files in folder
  const command = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: folderPath
  })

  const response = await s3Client.send(command)
  const files = response.Contents || []

  // Extract folder name from path
  const parts = folderPath.replace(/\/$/, '').split('/')
  const folderName = parts[parts.length - 1]

  // Find markdown file (prefer .svelte.md, then .md)
  let markdownKey = null
  let pdfKey = null

  for (const file of files) {
    const key = file.Key
    if (!key) continue

    if (key.endsWith('.svelte.md')) {
      markdownKey = key
    } else if (key.endsWith('.md') && !markdownKey) {
      markdownKey = key
    } else if (key.endsWith('.pdf')) {
      pdfKey = key
    }
  }

  // Fetch markdown content if found
  let markdown = null
  if (markdownKey) {
    const getCommand = new GetObjectCommand({
      Bucket: bucket,
      Key: markdownKey
    })
    const getResponse = await s3Client.send(getCommand)
    markdown = await streamToString(getResponse.Body)
  }

  return {
    markdown,
    pdfKey,
    folderName,
    markdownKey
  }
}

/**
 * Copy a file from one location to another (can be same or different bucket)
 *
 * @param {string} sourceBucket - Source bucket name
 * @param {string} sourceKey - Source object key
 * @param {string} destBucket - Destination bucket name
 * @param {string} destKey - Destination object key
 */
export async function copyFile(sourceBucket, sourceKey, destBucket, destKey) {
  const command = new CopyObjectCommand({
    CopySource: `${sourceBucket}/${sourceKey}`,
    Bucket: destBucket,
    Key: destKey
  })

  await s3Client.send(command)
}

/**
 * Upload string content to S3
 *
 * @param {string} bucket - Destination bucket name
 * @param {string} key - Object key
 * @param {string} content - String content to upload
 * @param {string} contentType - MIME content type (e.g., 'text/markdown')
 */
export async function uploadContent(bucket, key, content, contentType) {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: content,
    ContentType: contentType
  })

  await s3Client.send(command)
}

/**
 * List all files under a prefix (recursive)
 *
 * @param {string} bucket - S3 bucket name
 * @param {string} prefix - Prefix to list under
 * @returns {Promise<Array<{key: string, size: number}>>} Array of file info
 */
export async function listAllFiles(bucket, prefix) {
  const files = []
  let continuationToken = undefined

  do {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken
    })

    const response = await s3Client.send(command)

    if (response.Contents) {
      for (const item of response.Contents) {
        if (item.Key && item.Size !== undefined) {
          files.push({
            key: item.Key,
            size: item.Size
          })
        }
      }
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined
  } while (continuationToken)

  return files
}
