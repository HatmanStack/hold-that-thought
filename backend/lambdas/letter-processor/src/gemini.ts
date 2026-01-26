/**
 * Gemini AI integration for letter parsing
 */
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { ParsedLetterData, GeminiLetterResponse } from './types'
import { validateAndNormalizeParsedData } from './validation'
import { getGeminiApiKey } from './lib/config'
import {
  withRetry,
  isTransientError,
  TimeoutError,
  MaxRetriesExceededError,
} from './lib/retry'

// Retry configuration for Gemini API calls
const GEMINI_RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 8000,
  backoffMultiplier: 2,
  timeoutMs: 30000, // 30 second timeout per attempt
  isRetryable: isTransientError,
  onRetry: (attempt: number, error: unknown, delayMs: number) => {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.warn(
      `Gemini API attempt ${attempt} failed: ${errorMsg}. ` +
        `Retrying in ${delayMs}ms...`
    )
  },
}

/**
 * Parse a letter PDF using Gemini AI
 *
 * Extracts structured data including date, author, recipient, location,
 * full transcription, summary, and topic tags.
 *
 * Includes retry logic with exponential backoff for transient failures
 * and a 30-second timeout per attempt.
 */
export async function parseLetter(pdfBuffer: Buffer): Promise<ParsedLetterData> {
  const apiKey = getGeminiApiKey()

  const genAI = new GoogleGenerativeAI(apiKey)
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
    const rawData = await withRetry(async () => {
      const result = await model.generateContent(parts)
      const response = await result.response
      const text = response.text()

      // Clean up code blocks if present
      const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim()

      return JSON.parse(jsonStr) as GeminiLetterResponse
    }, GEMINI_RETRY_CONFIG)

    return validateAndNormalizeParsedData(rawData)
  } catch (err) {
    // Provide clear error messages for different failure modes
    if (err instanceof TimeoutError) {
      console.error('Gemini API timed out after multiple attempts')
      throw new Error(
        'Letter parsing timed out. The document may be too complex or the service is slow. ' +
          'Please try again later.'
      )
    }

    if (err instanceof MaxRetriesExceededError) {
      console.error(
        `Gemini API failed after ${err.attempts} attempts:`,
        err.lastError
      )
      throw new Error(
        'Letter parsing failed after multiple attempts. ' +
          'Please try again later or contact support if the issue persists.'
      )
    }

    console.error('Gemini processing failed:', err)
    throw err
  }
}
