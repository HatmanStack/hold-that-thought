import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { json } from '@sveltejs/kit'

export async function GET({ url }) {
  try {
    const path = url.searchParams.get('path')
    if (!path) {
      return new Response('Path parameter is required', { status: 400 })
    }

    console.log('GET request for path:', path)

    // Read from src/routes directory (live content)
    const srcRoutesPath = join(process.cwd(), 'src/routes', path.slice(1), '+page.svelte.md')
    console.log('Reading from:', srcRoutesPath)

    try {
      const content = await fs.readFile(srcRoutesPath, 'utf-8')
      console.log('Successfully read file, content length:', content.length)
      return json({ content })
    }
    catch (error) {
      console.error('Error reading markdown file:', error)
      return new Response('File not found', { status: 404 })
    }
  }
  catch (error) {
    console.error('Error in markdown endpoint:', error)
    return new Response('Internal server error', { status: 500 })
  }
}

export async function POST({ request }) {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] POST request received`)

  try {
    const { path, content } = await request.json()

    if (!path || content === undefined) {
      console.error(`[${timestamp}] Missing required fields:`, { path, contentLength: content?.length })
      return new Response('Path and content are required', { status: 400 })
    }

    console.log(`[${timestamp}] POST request for path:`, path)
    console.log(`[${timestamp}] Content length:`, content.length)

    try {
      // Save to src/routes directory (where displayed content is served from)
      const srcRoutesPath = join(process.cwd(), 'src/routes', path.slice(1), '+page.svelte.md')
      const srcRoutesDirPath = join(process.cwd(), 'src/routes', path.slice(1))

      console.log(`[${timestamp}] Writing to src/routes:`, srcRoutesPath)
      console.log(`[${timestamp}] Content preview:`, `${content.substring(0, 100)}...`)

      // Ensure directory exists
      await fs.mkdir(srcRoutesDirPath, { recursive: true })

      // Force SvelteKit cache invalidation by temporarily removing and recreating the file
      try {
        await fs.unlink(srcRoutesPath)
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      catch (e) {
        // File might not exist, that's ok
      }

      // Write to src/routes where displayed content is served from
      await fs.writeFile(srcRoutesPath, content, { encoding: 'utf8', flag: 'w' })

      // Force file system change detection by updating timestamps
      const now = new Date()
      await fs.utimes(srcRoutesPath, now, now)

      console.log(`[${timestamp}] Successfully wrote file to src/routes`)

      // Verify the file was written correctly
      const verifyContent = await fs.readFile(srcRoutesPath, 'utf-8')
      if (verifyContent !== content) {
        console.error(`[${timestamp}] Content verification failed`)
        throw new Error('Content verification failed')
      }
      console.log(`[${timestamp}] Content verified successfully in src/routes`)

      // Return success with metadata
      return json({
        success: true,
        path: srcRoutesPath,
        contentLength: content.length,
        timestamp,
      })
    }
    catch (error) {
      console.error(`[${timestamp}] Error writing markdown file:`, error)
      return new Response(`Failed to save file: ${error.message}`, { status: 500 })
    }
  }
  catch (error) {
    console.error(`[${timestamp}] Error in markdown save endpoint:`, error)
    return new Response('Internal server error', { status: 500 })
  }
}
