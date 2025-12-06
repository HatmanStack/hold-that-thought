import { mockClient } from 'aws-sdk-client-mock'
import { S3Client, ListObjectsV2Command, GetObjectCommand, CopyObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { Readable } from 'stream'

const s3Mock = mockClient(S3Client)

beforeEach(() => {
  s3Mock.reset()
})

// Dynamic import for ESM module
let s3Operations
beforeAll(async () => {
  s3Operations = await import('../../../backend/scripts/lib/s3-operations.js')
})

describe('s3 operations', () => {
  describe('listLetterFolders', () => {
    it('should list letter folders', async () => {
      s3Mock.on(ListObjectsV2Command).resolves({
        CommonPrefixes: [
          { Prefix: 'letters/Family Update Letter February 2016/' },
          { Prefix: 'letters/Christmas 2015/' }
        ],
        IsTruncated: false
      })

      const folders = await s3Operations.listLetterFolders('test-bucket', 'letters/')
      expect(folders).toHaveLength(2)
      expect(folders[0]).toBe('letters/Family Update Letter February 2016/')
      expect(folders[1]).toBe('letters/Christmas 2015/')
    })

    it('should handle pagination', async () => {
      s3Mock
        .on(ListObjectsV2Command, { ContinuationToken: undefined })
        .resolves({
          CommonPrefixes: [{ Prefix: 'letters/Letter 1/' }],
          IsTruncated: true,
          NextContinuationToken: 'token123'
        })
        .on(ListObjectsV2Command, { ContinuationToken: 'token123' })
        .resolves({
          CommonPrefixes: [{ Prefix: 'letters/Letter 2/' }],
          IsTruncated: false
        })

      const folders = await s3Operations.listLetterFolders('test-bucket', 'letters/')
      expect(folders).toHaveLength(2)
    })

    it('should return empty array for no folders', async () => {
      s3Mock.on(ListObjectsV2Command).resolves({
        CommonPrefixes: [],
        IsTruncated: false
      })

      const folders = await s3Operations.listLetterFolders('test-bucket', 'letters/')
      expect(folders).toHaveLength(0)
    })
  })

  describe('getLetterFiles', () => {
    it('should retrieve markdown and PDF files from folder', async () => {
      // Mock list to get files in folder
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [
          { Key: 'letters/Letter/+page.svelte.md' },
          { Key: 'letters/Letter/letter.pdf' }
        ],
        IsTruncated: false
      })

      // Mock get for markdown content
      const markdownStream = new Readable()
      markdownStream.push('---\ntitle: Test\n---\n\nContent')
      markdownStream.push(null)

      s3Mock.on(GetObjectCommand).resolves({
        Body: markdownStream
      })

      const result = await s3Operations.getLetterFiles('test-bucket', 'letters/Letter/')
      expect(result.markdown).toBe('---\ntitle: Test\n---\n\nContent')
      expect(result.pdfKey).toBe('letters/Letter/letter.pdf')
      expect(result.folderName).toBe('Letter')
    })

    it('should handle folders with .md files', async () => {
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [
          { Key: 'letters/Letter/content.md' },
          { Key: 'letters/Letter/document.pdf' }
        ],
        IsTruncated: false
      })

      const markdownStream = new Readable()
      markdownStream.push('Test content')
      markdownStream.push(null)

      s3Mock.on(GetObjectCommand).resolves({
        Body: markdownStream
      })

      const result = await s3Operations.getLetterFiles('test-bucket', 'letters/Letter/')
      expect(result.markdown).toBe('Test content')
      expect(result.pdfKey).toBe('letters/Letter/document.pdf')
    })

    it('should return null markdown if no markdown file found', async () => {
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [
          { Key: 'letters/Letter/document.pdf' },
          { Key: 'letters/Letter/image.png' }
        ],
        IsTruncated: false
      })

      const result = await s3Operations.getLetterFiles('test-bucket', 'letters/Letter/')
      expect(result.markdown).toBeNull()
      expect(result.pdfKey).toBe('letters/Letter/document.pdf')
    })
  })

  describe('copyFile', () => {
    it('should copy file between buckets', async () => {
      s3Mock.on(CopyObjectCommand).resolves({})

      await s3Operations.copyFile(
        'source-bucket', 'source/key.pdf',
        'dest-bucket', 'dest/key.pdf'
      )

      const calls = s3Mock.commandCalls(CopyObjectCommand)
      expect(calls).toHaveLength(1)
      expect(calls[0].args[0].input).toEqual({
        CopySource: 'source-bucket/source%2Fkey.pdf', // URL-encoded for special chars
        Bucket: 'dest-bucket',
        Key: 'dest/key.pdf'
      })
    })
  })

  describe('uploadContent', () => {
    it('should upload string content', async () => {
      s3Mock.on(PutObjectCommand).resolves({})

      await s3Operations.uploadContent(
        'dest-bucket',
        'letters/2016-02-10.md',
        '# Letter Content',
        'text/markdown'
      )

      const calls = s3Mock.commandCalls(PutObjectCommand)
      expect(calls).toHaveLength(1)
      expect(calls[0].args[0].input).toEqual({
        Bucket: 'dest-bucket',
        Key: 'letters/2016-02-10.md',
        Body: '# Letter Content',
        ContentType: 'text/markdown'
      })
    })
  })
})
