import { PUBLIC_RAGSTACK_API_KEY, PUBLIC_RAGSTACK_GRAPHQL_URL } from '$env/static/public'

const CREATE_UPLOAD_URL = `mutation CreateUploadUrl($filename: String!) {
  createUploadUrl(filename: $filename) {
    uploadUrl
    fields
  }
}`

const CREATE_IMAGE_UPLOAD_URL = `mutation CreateImageUploadUrl($filename: String!) {
  createImageUploadUrl(filename: $filename) {
    uploadUrl
    imageId
    s3Uri
    fields
  }
}`

const GENERATE_CAPTION = `mutation GenerateCaption($imageS3Uri: String!) {
  generateCaption(imageS3Uri: $imageS3Uri) {
    caption
  }
}`

const SUBMIT_IMAGE = `mutation SubmitImage($input: SubmitImageInput!) {
  submitImage(input: $input) {
    success
    message
  }
}`

async function graphqlRequest(query: string, variables: Record<string, unknown>) {
  if (!PUBLIC_RAGSTACK_GRAPHQL_URL || !PUBLIC_RAGSTACK_API_KEY) {
    throw new Error('RAGStack not configured')
  }

  const response = await fetch(PUBLIC_RAGSTACK_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': PUBLIC_RAGSTACK_API_KEY,
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!response.ok) {
    throw new Error(`RAGStack request failed: ${response.status}`)
  }

  const json = await response.json()

  if (json.errors) {
    throw new Error(json.errors[0]?.message || 'GraphQL error')
  }

  return json.data
}

export async function uploadDocumentToRagstack(file: File): Promise<void> {
  // 1. Get presigned URL
  const data = await graphqlRequest(CREATE_UPLOAD_URL, { filename: file.name })
  console.log('RAGStack createUploadUrl response:', data)

  const { uploadUrl, fields } = data.createUploadUrl
  console.log('uploadUrl:', uploadUrl)
  console.log('fields type:', typeof fields)
  console.log('fields value:', fields)

  // 2. Upload to S3 - fields come double-encoded from GraphQL
  const form = new FormData()
  let parsedFields = JSON.parse(fields)
  // Double-encoded: parse again if still a string
  if (typeof parsedFields === 'string') {
    console.log('Fields were double-encoded, parsing again...')
    parsedFields = JSON.parse(parsedFields)
  }
  console.log('parsedFields type:', typeof parsedFields)
  console.log('parsedFields keys:', Object.keys(parsedFields))

  Object.entries(parsedFields).forEach(([k, v]) => form.append(k, v as string))
  form.append('file', file)

  const uploadResponse = await fetch(uploadUrl, { method: 'POST', body: form })

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text()
    console.error('RAGStack upload error:', errorText)
    throw new Error(`Failed to upload document to RAGStack: ${uploadResponse.status}`)
  }

  console.log('RAGStack document upload successful')
}

export async function uploadImageToRagstack(
  file: File,
  userCaption?: string,
): Promise<void> {
  // 1. Get presigned URL
  const data = await graphqlRequest(CREATE_IMAGE_UPLOAD_URL, { filename: file.name })
  console.log('RAGStack createImageUploadUrl response:', data)

  const { uploadUrl, imageId, s3Uri, fields } = data.createImageUploadUrl
  console.log('uploadUrl:', uploadUrl)
  console.log('imageId:', imageId)
  console.log('s3Uri:', s3Uri)
  console.log('fields type:', typeof fields)

  // 2. Upload to S3 - fields come double-encoded from GraphQL
  const form = new FormData()
  let parsedFields = JSON.parse(fields)
  if (typeof parsedFields === 'string') {
    console.log('Fields were double-encoded, parsing again...')
    parsedFields = JSON.parse(parsedFields)
  }
  console.log('parsedFields keys:', Object.keys(parsedFields))

  Object.entries(parsedFields).forEach(([k, v]) => form.append(k, v as string))
  form.append('file', file)

  const uploadResponse = await fetch(uploadUrl, { method: 'POST', body: form })

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text()
    console.error('RAGStack image upload error:', errorText)
    throw new Error('Failed to upload image to RAGStack')
  }

  console.log('RAGStack image upload successful, generating caption...')

  // 3. Generate AI caption
  let aiCaption = ''
  try {
    const captionData = await graphqlRequest(GENERATE_CAPTION, { imageS3Uri: s3Uri })
    aiCaption = captionData.generateCaption?.caption || ''
    console.log('AI caption:', aiCaption)
  }
  catch (err) {
    console.warn('Failed to generate AI caption:', err)
  }

  // 4. Submit with caption (triggers processing)
  console.log('Submitting image with caption...')
  await graphqlRequest(SUBMIT_IMAGE, {
    input: {
      imageId,
      userCaption: userCaption || file.name,
      aiCaption,
    },
  })

  console.log('RAGStack image processing complete')
}

export async function uploadToRagstack(file: File, userCaption?: string): Promise<void> {
  const isImage = file.type.startsWith('image/')
  const isVideo = file.type.startsWith('video/')

  if (isImage) {
    await uploadImageToRagstack(file, userCaption)
  }
  else if (isVideo) {
    // Videos treated as images in RAGStack (for thumbnail/caption)
    await uploadImageToRagstack(file, userCaption)
  }
  else {
    // Documents (PDF, DOC, etc.)
    await uploadDocumentToRagstack(file)
  }
}
