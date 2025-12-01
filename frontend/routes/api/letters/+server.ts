import type { RequestHandler } from './$types'
import fs from 'node:fs/promises'
import path from 'node:path'
import { json } from '@sveltejs/kit'

function getLetterPath(letterPath: string): string {
  const cleanPath = letterPath.startsWith('/') ? letterPath.slice(1) : letterPath
  return path.join(process.cwd(), 'src', 'routes', cleanPath, '+page.svelte.md')
}

export const GET: RequestHandler = async ({ url }) => {
  try {
    const letterPath = url.searchParams.get('path')
    if (!letterPath) {
      return new Response('Letter path is required', { status: 400 })
    }

    const fullPath = getLetterPath(letterPath)
    const content = await fs.readFile(fullPath, 'utf-8')

    return json({ content })
  }
  catch (error) {
    console.error('Error reading letter:', error)
    return new Response('Failed to read letter', { status: 500 })
  }
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { path: letterPath, content } = await request.json()
    if (!letterPath || !content) {
      return new Response('Path and content are required', { status: 400 })
    }

    const fullPath = getLetterPath(letterPath)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, content, 'utf-8')

    return json({ success: true })
  }
  catch (error) {
    console.error('Error saving letter:', error)
    return new Response('Failed to save letter', { status: 500 })
  }
}
