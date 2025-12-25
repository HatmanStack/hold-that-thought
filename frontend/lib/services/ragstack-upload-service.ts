import { PUBLIC_RAGSTACK_API_KEY, PUBLIC_RAGSTACK_GRAPHQL_URL } from '$env/static/public'

const CREATE_UPLOAD_URL = `mutation CreateUploadUrl($filename: String!) {
  createUploadUrl(filename: $filename) {
    uploadUrl
    fields
  }
}`

const CREATE_IMAGE_UPLOAD_URL = `mutation CreateImageUploadUrl($filename: String!, $autoProcess: Boolean, $userCaption: String) {
  createImageUploadUrl(filename: $filename, autoProcess: $autoProcess, userCaption: $userCaption) {
    uploadUrl
    imageId
    fields
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
  const data = await graphqlRequest(CREATE_UPLOAD_URL, { filename: file.name })
  const { uploadUrl, fields } = data.createUploadUrl

  const form = new FormData()
  let parsedFields = JSON.parse(fields)
  if (typeof parsedFields === 'string') {
    parsedFields = JSON.parse(parsedFields)
  }

  Object.entries(parsedFields).forEach(([k, v]) => form.append(k, v as string))
  form.append('file', file)

  const uploadResponse = await fetch(uploadUrl, { method: 'POST', body: form })

  if (!uploadResponse.ok) {
    throw new Error(`Failed to upload document to RAGStack: ${uploadResponse.status}`)
  }
}

export async function uploadImageToRagstack(
  file: File,
  userCaption?: string,
): Promise<string> {
  const data = await graphqlRequest(CREATE_IMAGE_UPLOAD_URL, {
    filename: file.name,
    autoProcess: true,
    userCaption: userCaption || '',
  })

  const { uploadUrl, imageId, fields } = data.createImageUploadUrl

  const form = new FormData()
  let parsedFields = JSON.parse(fields)
  if (typeof parsedFields === 'string') {
    parsedFields = JSON.parse(parsedFields)
  }

  Object.entries(parsedFields).forEach(([k, v]) => form.append(k, v as string))
  form.append('file', file)

  const uploadResponse = await fetch(uploadUrl, { method: 'POST', body: form })

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload image to RAGStack S3')
  }

  return imageId
}

export async function uploadToRagstack(file: File, userCaption?: string): Promise<void> {
  const isImage = file.type.startsWith('image/')
  const isVideo = file.type.startsWith('video/')

  if (isVideo) {
    // Videos only go to S3 archive, not RAGStack
    return
  }

  if (isImage) {
    await uploadImageToRagstack(file, userCaption)
  }
  else {
    // Documents (PDF, DOC, etc.)
    await uploadDocumentToRagstack(file)
  }
}
