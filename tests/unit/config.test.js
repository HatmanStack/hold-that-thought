import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('letter-processor config', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
    // Set required env vars for most tests
    process.env.TABLE_NAME = 'test-table'
    process.env.ARCHIVE_BUCKET = 'test-bucket'
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('config loading', () => {
    it('should load config successfully with valid env vars', async () => {
      process.env.GEMINI_API_KEY = 'AIzaSyTestKeyThatIsLongEnough123456789'

      const { config } = await import(
        '../../backend/lambdas/letter-processor/src/lib/config.ts'
      )

      expect(config.geminiApiKey).toBe('AIzaSyTestKeyThatIsLongEnough123456789')
      expect(config.tableName).toBe('test-table')
      expect(config.archiveBucket).toBe('test-bucket')
    })

    it('should throw error if TABLE_NAME is not set', async () => {
      delete process.env.TABLE_NAME
      process.env.GEMINI_API_KEY = 'AIzaSyTestKey123456789'

      await expect(
        import('../../backend/lambdas/letter-processor/src/lib/config.ts')
      ).rejects.toThrow('TABLE_NAME environment variable is not set')
    })

    it('should throw error if ARCHIVE_BUCKET is not set', async () => {
      delete process.env.ARCHIVE_BUCKET
      process.env.GEMINI_API_KEY = 'AIzaSyTestKey123456789'

      await expect(
        import('../../backend/lambdas/letter-processor/src/lib/config.ts')
      ).rejects.toThrow('ARCHIVE_BUCKET environment variable is not set')
    })

    it('should allow missing GEMINI_API_KEY in test environment', async () => {
      process.env.NODE_ENV = 'test'
      delete process.env.GEMINI_API_KEY

      const { config } = await import(
        '../../backend/lambdas/letter-processor/src/lib/config.ts'
      )

      expect(config.geminiApiKey).toBe('')
    })
  })

  describe('getGeminiApiKey', () => {
    it('should return API key when configured', async () => {
      process.env.GEMINI_API_KEY = 'AIzaSyTestKeyThatIsLongEnough123456789'

      const { getGeminiApiKey } = await import(
        '../../backend/lambdas/letter-processor/src/lib/config.ts'
      )

      expect(getGeminiApiKey()).toBe('AIzaSyTestKeyThatIsLongEnough123456789')
    })

    it('should throw error when API key is not configured', async () => {
      process.env.NODE_ENV = 'test' // Allow config to load
      delete process.env.GEMINI_API_KEY

      const { getGeminiApiKey } = await import(
        '../../backend/lambdas/letter-processor/src/lib/config.ts'
      )

      expect(() => getGeminiApiKey()).toThrow('Gemini API key is not configured')
    })
  })

  describe('placeholder detection', () => {
    it('should warn about placeholder API keys', async () => {
      // Ensure we're not in test mode so validation runs
      delete process.env.NODE_ENV
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      process.env.GEMINI_API_KEY = 'your-api-key'

      await import('../../backend/lambdas/letter-processor/src/lib/config.ts')

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('CONFIG_WARNING')
      )
      consoleSpy.mockRestore()
    })

    it('should warn about short API keys', async () => {
      // Ensure we're not in test mode so validation runs
      delete process.env.NODE_ENV
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      process.env.GEMINI_API_KEY = 'short'

      await import('../../backend/lambdas/letter-processor/src/lib/config.ts')

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('unusually short')
      )
      consoleSpy.mockRestore()
    })

    it('should detect various placeholder patterns', async () => {
      const placeholders = [
        'your-api-key',
        'YOUR_API_KEY',
        'test-key',
        'TEST_KEY',
        'placeholder',
        'PLACEHOLDER',
        'xxx',
        'XXXXX',
        'TODO',
        'REPLACE_ME',
      ]

      for (const placeholder of placeholders) {
        vi.resetModules()
        process.env.TABLE_NAME = 'test-table'
        process.env.ARCHIVE_BUCKET = 'test-bucket'
        process.env.GEMINI_API_KEY = placeholder
        // Ensure we're not in test mode so validation runs
        delete process.env.NODE_ENV

        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

        await import('../../backend/lambdas/letter-processor/src/lib/config.ts')

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('CONFIG_WARNING')
        )
        consoleSpy.mockRestore()
      }
    })
  })
})
