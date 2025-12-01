import { contentService } from '$lib/services/content-service'
import { json } from '@sveltejs/kit'

export async function GET({ url }) {
  try {
    const path = url.searchParams.get('path')
    if (!path) {
      return new Response('Path parameter is required', { status: 400 })
    }

    console.log('GET content request for path:', path)

    const content = await contentService.getContent(path)
    console.log('Successfully retrieved content from S3, length:', content.length)

    return json({ content })
  }
  catch (error) {
    console.error('Error in content GET endpoint:', error)

    if (error.message.includes('not found')) {
      return new Response('Content not found', { status: 404 })
    }

    return new Response('Internal server error', { status: 500 })
  }
}

export async function POST({ request }) {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] POST content request received`)

  try {
    const { path, content, type } = await request.json()

    if (!path || content === undefined) {
      console.error(`[${timestamp}] Missing required fields:`, { path, contentLength: content?.length })
      return new Response('Path and content are required', { status: 400 })
    }

    console.log(`[${timestamp}] POST content request for path:`, path)
    console.log(`[${timestamp}] Content length:`, content.length)
    console.log(`[${timestamp}] Content type:`, type)

    const success = await contentService.saveContent(path, content)

    if (success) {
      console.log(`[${timestamp}] Successfully saved content to S3`)
      return json({
        success: true,
        path,
        contentLength: content.length,
        timestamp,
        type,
      })
    }
    else {
      throw new Error('Save operation returned false')
    }
  }
  catch (error) {
    console.error(`[${timestamp}] Error in content save endpoint:`, error)
    return new Response(`Failed to save content: ${error.message}`, { status: 500 })
  }
}

export async function DELETE({ url }) {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] DELETE content request received`)

  try {
    const path = url.searchParams.get('path')
    if (!path) {
      return new Response('Path parameter is required', { status: 400 })
    }

    console.log(`[${timestamp}] DELETE content request for path:`, path)

    const success = await contentService.deleteContent(path)

    if (success) {
      console.log(`[${timestamp}] Successfully deleted content from S3`)
      return json({
        success: true,
        path,
        timestamp,
      })
    }
    else {
      throw new Error('Delete operation returned false')
    }
  }
  catch (error) {
    console.error(`[${timestamp}] Error in content delete endpoint:`, error)
    return new Response(`Failed to delete content: ${error.message}`, { status: 500 })
  }
}
