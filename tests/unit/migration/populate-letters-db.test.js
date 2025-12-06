import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockClient } from 'aws-sdk-client-mock'
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3'
import { Readable } from 'stream'

// Create mocks
const ddbMock = mockClient(DynamoDBDocumentClient)
const s3Mock = mockClient(S3Client)

// Helper to create readable stream from string
function createReadableStream(content) {
  return Readable.from([Buffer.from(content)])
}

// Import after mocks are set up
const { runPopulation } = await import('../../../backend/scripts/populate-letters-db.js')

beforeEach(() => {
  ddbMock.reset()
  s3Mock.reset()
})

describe('populate letters DB', () => {
  describe('extractTitle', () => {
    it('should extract title from heading', async () => {
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [{ Key: 'letters/2016-02-10.md' }]
      })

      s3Mock.on(GetObjectCommand).resolves({
        Body: createReadableStream('# Family Update February 2016\n\nDear Family...')
      })

      ddbMock.on(GetCommand).resolves({ Item: null })
      ddbMock.on(PutCommand).resolves({})

      const report = await runPopulation({
        bucket: 'test-bucket',
        prefix: 'letters/',
        tableName: 'test-table',
        dryRun: false,
        skipExisting: false
      })

      expect(report.populated).toBe(1)
      expect(report.successes[0].title).toBe('Family Update February 2016')
    })
  })

  describe('runPopulation', () => {
    it('should create correct DynamoDB items', async () => {
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [
          { Key: 'letters/2016-02-10.md' },
          { Key: 'letters/2016-02-10.pdf' }
        ]
      })

      s3Mock.on(GetObjectCommand).resolves({
        Body: createReadableStream('# Test Letter\n\nContent here')
      })

      ddbMock.on(GetCommand).resolves({ Item: null })
      ddbMock.on(PutCommand).resolves({})

      const report = await runPopulation({
        bucket: 'test-bucket',
        prefix: 'letters/',
        tableName: 'test-table',
        dryRun: false,
        skipExisting: false
      })

      expect(report.total).toBe(1)
      expect(report.populated).toBe(1)
      expect(report.successes[0].dateKey).toBe('2016-02-10')
      expect(report.successes[0].hasPdf).toBe(true)

      // Verify DynamoDB put was called
      const putCalls = ddbMock.commandCalls(PutCommand)
      expect(putCalls).toHaveLength(1)

      const putItem = putCalls[0].args[0].input.Item
      expect(putItem.PK).toBe('LETTER#2016-02-10')
      expect(putItem.SK).toBe('CURRENT')
      expect(putItem.GSI1PK).toBe('LETTERS')
      expect(putItem.GSI1SK).toBe('2016-02-10')
      expect(putItem.title).toBe('Test Letter')
      expect(putItem.pdfKey).toBe('letters/2016-02-10.pdf')
      expect(putItem.entityType).toBe('LETTER')
    })

    it('should skip existing letters when skipExisting is true', async () => {
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [{ Key: 'letters/2016-02-10.md' }]
      })

      // Return existing item
      ddbMock.on(GetCommand).resolves({
        Item: { PK: 'LETTER#2016-02-10' }
      })

      const report = await runPopulation({
        bucket: 'test-bucket',
        prefix: 'letters/',
        tableName: 'test-table',
        dryRun: false,
        skipExisting: true
      })

      expect(report.total).toBe(1)
      expect(report.skipped).toBe(1)
      expect(report.populated).toBe(0)

      // Verify PutCommand was NOT called
      const putCalls = ddbMock.commandCalls(PutCommand)
      expect(putCalls).toHaveLength(0)
    })

    it('should handle letters without PDFs', async () => {
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [{ Key: 'letters/2015-12-25.md' }]
        // No PDF file
      })

      s3Mock.on(GetObjectCommand).resolves({
        Body: createReadableStream('# Christmas Letter\n\nMerry Christmas!')
      })

      ddbMock.on(GetCommand).resolves({ Item: null })
      ddbMock.on(PutCommand).resolves({})

      const report = await runPopulation({
        bucket: 'test-bucket',
        prefix: 'letters/',
        tableName: 'test-table',
        dryRun: false,
        skipExisting: false
      })

      expect(report.populated).toBe(1)
      expect(report.successes[0].hasPdf).toBe(false)

      const putCalls = ddbMock.commandCalls(PutCommand)
      const putItem = putCalls[0].args[0].input.Item
      expect(putItem.pdfKey).toBeNull()
    })

    it('should handle slug-suffixed date keys', async () => {
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [
          { Key: 'letters/2016-02-10-family-update.md' },
          { Key: 'letters/2016-02-10-family-update.pdf' }
        ]
      })

      s3Mock.on(GetObjectCommand).resolves({
        Body: createReadableStream('# Family Update\n\nContent')
      })

      ddbMock.on(GetCommand).resolves({ Item: null })
      ddbMock.on(PutCommand).resolves({})

      const report = await runPopulation({
        bucket: 'test-bucket',
        prefix: 'letters/',
        tableName: 'test-table',
        dryRun: false,
        skipExisting: false
      })

      expect(report.populated).toBe(1)

      const putCalls = ddbMock.commandCalls(PutCommand)
      const putItem = putCalls[0].args[0].input.Item

      // Full key includes slug
      expect(putItem.PK).toBe('LETTER#2016-02-10-family-update')
      // GSI1SK is just the date for sorting
      expect(putItem.GSI1SK).toBe('2016-02-10')
    })

    it('should not write to DynamoDB in dry-run mode', async () => {
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [{ Key: 'letters/2016-02-10.md' }]
      })

      s3Mock.on(GetObjectCommand).resolves({
        Body: createReadableStream('# Test\n\nContent')
      })

      const report = await runPopulation({
        bucket: 'test-bucket',
        prefix: 'letters/',
        tableName: 'test-table',
        dryRun: true,
        skipExisting: false
      })

      expect(report.populated).toBe(1)

      // Verify PutCommand was NOT called
      const putCalls = ddbMock.commandCalls(PutCommand)
      expect(putCalls).toHaveLength(0)
    })

    it('should process multiple letters', async () => {
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [
          { Key: 'letters/2016-02-10.md' },
          { Key: 'letters/2016-02-10.pdf' },
          { Key: 'letters/2015-12-25.md' },
          { Key: 'letters/2015-06-15.md' },
          { Key: 'letters/2015-06-15.pdf' }
        ]
      })

      s3Mock.on(GetObjectCommand).resolves({
        Body: createReadableStream('# Test Letter\n\nContent')
      })

      ddbMock.on(GetCommand).resolves({ Item: null })
      ddbMock.on(PutCommand).resolves({})

      const report = await runPopulation({
        bucket: 'test-bucket',
        prefix: 'letters/',
        tableName: 'test-table',
        dryRun: false,
        skipExisting: false
      })

      expect(report.total).toBe(3)
      expect(report.populated).toBe(3)

      const putCalls = ddbMock.commandCalls(PutCommand)
      expect(putCalls).toHaveLength(3)
    })

    it('should report failures', async () => {
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [{ Key: 'letters/2016-02-10.md' }]
      })

      s3Mock.on(GetObjectCommand).rejects(new Error('S3 access denied'))

      const report = await runPopulation({
        bucket: 'test-bucket',
        prefix: 'letters/',
        tableName: 'test-table',
        dryRun: false,
        skipExisting: false
      })

      expect(report.total).toBe(1)
      expect(report.failed).toBe(1)
      expect(report.failures[0].error).toContain('S3 access denied')
    })
  })
})
