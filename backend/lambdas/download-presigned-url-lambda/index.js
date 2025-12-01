import fs from 'node:fs'
import path from 'node:path'
import { callGoogleGenAIOCRBatch } from './utils/gemini_api.js'
import { getMarkdownContent, getPresignedUrlForPdf, getS3PdfKeys, startec2, updateS3Items } from './utils/s3_update.js'

const BUCKET_NAME = process.env.BUCKET_NAME

function sanitizeTitle(title) {
  const sanitized = title.replace(/[/\\]+/g, '_').replace(/\.\./g, '_').trim()
  if (!sanitized || sanitized.length === 0) {
    throw new Error('Invalid title: title cannot be empty after sanitization')
  }
  return sanitized
}

export async function handler(event, context) {
  if (!BUCKET_NAME) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Server configuration error: Bucket name missing.' }),
    }
  }

  try {
    const task = event

    if (!task || typeof task !== 'object') {
      throw new Error(`Invalid payload received. Expected an object, got: ${typeof task}`)
    }
    if (!task.type) {
      throw new Error('Task object missing \'type\' property.')
    }

    if (task.type === 'update') {
      if (!task.title || typeof task.content === 'undefined') {
        throw new Error('Missing \'title\' or \'content\' for update task.')
      }

      const sanitizedTitle = sanitizeTitle(task.title)
      const items = [
        { key: `urara/${sanitizedTitle}/+page.svelte.md`, body: task.content },
      ]
      await updateS3Items(BUCKET_NAME, items)
      return {
        statusCode: 200,
        body: JSON.stringify({ message: `Successfully updated ${sanitizedTitle}` }),
      }
    }

    else if (task.type === 'create') {
      if (!Array.isArray(task.files) || task.files.length === 0) {
        throw new Error('Missing or empty \'files\' array for create task.')
      }

      const ocrResult = await callGoogleGenAIOCRBatch(task.files)
      if (!ocrResult || typeof ocrResult !== 'string' || !ocrResult.includes('|||||')) {
        throw new Error('Invalid OCR result format: missing delimiter')
      }
      const holder = ocrResult.split('|||||')
      if (holder.length < 2) {
        throw new Error('Invalid OCR result format: expected title section')
      }
      const lines = holder[0].split('\n')
      if (lines.length < 3) {
        throw new Error('Invalid OCR result format: content too short')
      }
      const middleLines = lines.slice(1, -1)
      const markdown = middleLines.join('\n')
      const rawTitle = holder[1].trim().replace(/`/g, '')
      const title = sanitizeTitle(rawTitle)
      const markdownFilePath = `/tmp/${title}.md`
      fs.writeFileSync(markdownFilePath, markdown)

      const pdfPath = '/tmp/final_merged_document.pdf'
      if (!fs.existsSync(pdfPath)) {
        throw new Error('Merged PDF document not found after OCR processing')
      }

      const itemsToUpload = [
        {
          key: `urara/${title}/+page.svelte.md`,
          body: fs.readFileSync(markdownFilePath),
        },
        {
          key: `urara/${title}/document.pdf`,
          body: fs.readFileSync(pdfPath),
        },
      ]

      await updateS3Items(BUCKET_NAME, itemsToUpload)
      await startec2()
      return {
        statusCode: 200,
        body: JSON.stringify({ message: `Successfully created entry for ${title}` }),
      }
    }
    else if (task.type === 'deploy') {
      await startec2()
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: `Successfully initiated start for instance`,
        }),
      }
    }

    else if (task.type === 'downloadMD') {
      const titleForPrefix = task.title || ''
      if (!titleForPrefix) {
        throw new Error('Missing \'title\' for downloadMD task.')
      }
      const sanitizedTitle = sanitizeTitle(titleForPrefix)
      const targetKey = `urara/${sanitizedTitle}/+page.svelte.md`

      const downloadUrl = await getMarkdownContent(BUCKET_NAME, targetKey)
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Download URL generated successfully.',
          downloadUrl,
        }),
      }
    }
    else if (task.type === 'download') {
      const titleForPrefix = task.title || ''
      if (!titleForPrefix) {
        throw new Error('Missing \'title\' for download task.')
      }
      const sanitizedTitle = sanitizeTitle(titleForPrefix)
      const prefix = `urara/${sanitizedTitle}/`

      const pdfKeys = await getS3PdfKeys(BUCKET_NAME, prefix)

      if (!pdfKeys || pdfKeys.length === 0) {
        return {
          statusCode: 404,
          body: JSON.stringify({ message: 'No PDF document found for that title.' }),
        }
      }

      const targetKey = pdfKeys[0]

      const downloadUrl = await getPresignedUrlForPdf(BUCKET_NAME, targetKey)

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Download URL generated successfully.',
          downloadUrl,
          fileNameSuggestion: path.basename(targetKey),
        }),
      }
    }
    else {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: `Unknown task type: ${task.type}` }),
      }
    }
  }
  catch (error) {
    console.error('Error processing Lambda event:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'An error occurred while processing the request.',
      }),
    }
  }
}
