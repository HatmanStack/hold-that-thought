import { mockClient } from 'aws-sdk-client-mock'
import { S3Client, ListObjectsV2Command, GetObjectCommand, CopyObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { Readable } from 'stream'

const s3Mock = mockClient(S3Client)

beforeEach(() => {
  s3Mock.reset()
})

// Dynamic import for ESM module
let migrateLetters
beforeAll(async () => {
  migrateLetters = await import('../../../backend/scripts/migrate-letters.js')
})

describe('migration script', () => {
  describe('processLetter', () => {
    it('should process letter folder correctly', async () => {
      // Mock list files in folder
      s3Mock.on(ListObjectsV2Command, { Prefix: 'urara/Family Letter/' }).resolves({
        Contents: [
          { Key: 'urara/Family Letter/+page.svelte.md' },
          { Key: 'urara/Family Letter/letter.pdf' }
        ],
        IsTruncated: false
      })

      // Mock get markdown content
      const markdownStream = new Readable()
      markdownStream.push('---\ntitle: "Family Letter"\n---\n\nFebruary 10, 2016\n\nDear Family,')
      markdownStream.push(null)

      s3Mock.on(GetObjectCommand).resolves({
        Body: markdownStream
      })

      // Mock copy and upload
      s3Mock.on(CopyObjectCommand).resolves({})
      s3Mock.on(PutObjectCommand).resolves({})

      const existingDates = new Set()
      const result = await migrateLetters.processLetter(
        'source-bucket',
        'urara/Family Letter/',
        'dest-bucket',
        'letters/',
        existingDates,
        false // not dry-run
      )

      expect(result.success).toBe(true)
      expect(result.date).toBe('2016-02-10')
      expect(result.mdFile).toBe('2016-02-10.md')
      expect(existingDates.has('2016-02-10')).toBe(true)
    })

    it('should handle date extraction failure gracefully', async () => {
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [
          { Key: 'urara/Unknown Letter/+page.svelte.md' }
        ],
        IsTruncated: false
      })

      const markdownStream = new Readable()
      markdownStream.push('---\ntitle: "Unknown"\n---\n\nDear Family, no date here')
      markdownStream.push(null)

      s3Mock.on(GetObjectCommand).resolves({
        Body: markdownStream
      })

      const existingDates = new Set()
      const result = await migrateLetters.processLetter(
        'source-bucket',
        'urara/Unknown Letter/',
        'dest-bucket',
        'letters/',
        existingDates,
        false
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('date')
    })

    it('should not modify files in dry-run mode', async () => {
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [
          { Key: 'urara/Letter/+page.svelte.md' },
          { Key: 'urara/Letter/letter.pdf' }
        ],
        IsTruncated: false
      })

      const markdownStream = new Readable()
      markdownStream.push('---\ntitle: "Test"\n---\n\nMarch 5, 2016\n\nContent')
      markdownStream.push(null)

      s3Mock.on(GetObjectCommand).resolves({
        Body: markdownStream
      })

      const existingDates = new Set()
      const result = await migrateLetters.processLetter(
        'source-bucket',
        'urara/Letter/',
        'dest-bucket',
        'letters/',
        existingDates,
        true // dry-run
      )

      expect(result.success).toBe(true)
      expect(result.dryRun).toBe(true)

      // Verify no copy/upload calls were made
      const copyCalls = s3Mock.commandCalls(CopyObjectCommand)
      const putCalls = s3Mock.commandCalls(PutObjectCommand)
      expect(copyCalls).toHaveLength(0)
      expect(putCalls).toHaveLength(0)
    })
  })

  describe('generateReport', () => {
    it('should generate accurate report', () => {
      const results = [
        { success: true, folder: 'Letter 1', date: '2016-02-10' },
        { success: true, folder: 'Letter 2', date: '2016-03-15' },
        { success: false, folder: 'Letter 3', error: 'No date found' }
      ]

      const report = migrateLetters.generateReport(results)

      expect(report.total).toBe(3)
      expect(report.successful).toBe(2)
      expect(report.failed).toBe(1)
      expect(report.failures).toHaveLength(1)
      expect(report.failures[0].folder).toBe('Letter 3')
    })
  })
})
