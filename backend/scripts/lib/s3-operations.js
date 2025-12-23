import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  CopyObjectCommand,
  PutObjectCommand
} from '@aws-sdk/client-s3'

// S3 client configuration - uses default credentials from environment
const s3Client = new S3Client({})

async function streamToString(stream) {
  const chunks = []
  for await (const chunk of stream) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf-8')
}

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

export async function copyFile(sourceBucket, sourceKey, destBucket, destKey) {
  // URL-encode the source key to handle special characters (spaces, etc.)
  const encodedSourceKey = encodeURIComponent(sourceKey)
  const command = new CopyObjectCommand({
    CopySource: `${sourceBucket}/${encodedSourceKey}`,
    Bucket: destBucket,
    Key: destKey
  })

  await s3Client.send(command)
}

export async function uploadContent(bucket, key, content, contentType) {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: content,
    ContentType: contentType
  })

  await s3Client.send(command)
}

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
