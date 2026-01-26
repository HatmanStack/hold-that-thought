/**
 * Gemini AI integration for letter parsing
 */
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { ParsedLetterData, GeminiLetterResponse } from './types'
import { validateAndNormalizeParsedData } from './validation'

const API_KEY = process.env.GEMINI_API_KEY

/**
 * Parse a letter PDF using Gemini AI
 *
 * Extracts structured data including date, author, recipient, location,
 * full transcription, summary, and topic tags.
 */
export async function parseLetter(pdfBuffer: Buffer): Promise<ParsedLetterData> {
  if (!API_KEY) {
    throw new Error('GEMINI_API_KEY not set')
  }

  const genAI = new GoogleGenerativeAI(API_KEY)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const prompt = `
    Analyze this letter. Extract the following information in JSON format:
    - date: YYYY-MM-DD (approximate if not explicit, use 1900-01-01 if unknown)
    - author: Name of sender
    - recipient: Name of recipient
    - location: Origin location/city
    - content: Full text transcription (preserve paragraphs)
    - summary: A brief 2-3 sentence summary
    - tags: Array of 3-5 keywords/topics

    Return ONLY the JSON object. Do not include markdown formatting.
  `

  const parts = [
    prompt,
    {
      inlineData: {
        data: Buffer.from(pdfBuffer).toString('base64'),
        mimeType: 'application/pdf',
      },
    },
  ]

  try {
    const result = await model.generateContent(parts)
    const response = await result.response
    const text = response.text()

    // Clean up code blocks if present
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim()

    const rawData = JSON.parse(jsonStr) as GeminiLetterResponse
    return validateAndNormalizeParsedData(rawData)
  } catch (err) {
    console.error('Gemini processing failed:', err)
    throw err
  }
}
