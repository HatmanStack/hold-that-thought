const { mockClient } = require('aws-sdk-client-mock')
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb')
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3')

// Create mocks BEFORE setting env vars or importing handler
const ddbMock = mockClient(DynamoDBDocumentClient)
const s3Mock = mockClient(S3Client)

// Set env vars BEFORE importing handler
process.env.TABLE_NAME = 'test-table'
process.env.ARCHIVE_BUCKET = 'test-archive-bucket'

// Import handler after mock is created
const { handle } = require('../../backend/lambdas/api/routes/letters')

beforeEach(() => {
  ddbMock.reset()
  s3Mock.reset()
})

describe('letters API Lambda', () => {
  describe('routing', () => {
    it('should route GET /letters to listLetters', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] })

      const event = {
        httpMethod: 'GET',
        resource: '/letters',
        queryStringParameters: {},
      }

      const response = await handle(event, {})

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.items).toEqual([])
    })

    it('should route GET /letters/{date} to getLetter', async () => {
      ddbMock.on(GetCommand).resolves({ Item: null })

      const event = {
        httpMethod: 'GET',
        resource: '/letters/{date}',
        pathParameters: { date: '2016-02-10' },
      }

      const response = await handle(event, {})

      expect(response.statusCode).toBe(404)
    })

    it('should return 404 for unknown routes', async () => {
      const event = {
        httpMethod: 'PATCH',
        resource: '/letters/unknown',
      }

      const response = await handle(event, {})

      expect(response.statusCode).toBe(404)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Route not found')
    })
  })

  describe('GET /letters', () => {
    it('should return paginated letters', async () => {
      ddbMock.on(QueryCommand).resolves({
        Items: [
          {
            PK: 'LETTER#2016-02-10',
            SK: 'CURRENT',
            GSI1PK: 'LETTERS',
            GSI1SK: '2016-02-10',
            title: 'Family Update',
            originalTitle: 'Family Update Letter February 2016',
            updatedAt: '2025-01-15T10:00:00.000Z',
          },
          {
            PK: 'LETTER#2015-12-25',
            SK: 'CURRENT',
            GSI1PK: 'LETTERS',
            GSI1SK: '2015-12-25',
            title: 'Christmas Letter',
            originalTitle: 'Christmas 2015',
            updatedAt: '2025-01-10T10:00:00.000Z',
          },
        ],
      })

      const event = {
        httpMethod: 'GET',
        resource: '/letters',
        queryStringParameters: { limit: '50' },
      }

      const response = await handle(event, {})

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.items).toHaveLength(2)
      expect(body.items[0].date).toBe('2016-02-10')
      expect(body.items[0].title).toBe('Family Update')
      expect(body.nextCursor).toBeNull()
    })

    it('should handle pagination cursor', async () => {
      const lastKey = { PK: 'LETTER#2016-02-10', SK: 'CURRENT', GSI1PK: 'LETTERS', GSI1SK: '2016-02-10' }
      const cursor = Buffer.from(JSON.stringify(lastKey)).toString('base64')

      ddbMock.on(QueryCommand).resolves({
        Items: [
          { GSI1SK: '2015-12-25', title: 'Christmas Letter' },
        ],
        LastEvaluatedKey: null,
      })

      const event = {
        httpMethod: 'GET',
        resource: '/letters',
        queryStringParameters: { cursor },
      }

      const response = await handle(event, {})

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.items).toHaveLength(1)
    })

    it('should return empty list when no letters', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] })

      const event = {
        httpMethod: 'GET',
        resource: '/letters',
        queryStringParameters: {},
      }

      const response = await handle(event, {})

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.items).toHaveLength(0)
    })
  })

  describe('GET /letters/{date}', () => {
    it('should return letter content', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          PK: 'LETTER#2016-02-10',
          SK: 'CURRENT',
          title: 'Family Update',
          originalTitle: 'Family Update Letter February 2016',
          content: 'Dear Family...',
          pdfKey: 'letters/2016-02-10.pdf',
          createdAt: '2025-01-15T10:00:00.000Z',
          updatedAt: '2025-01-15T10:00:00.000Z',
          lastEditedBy: null,
          versionCount: 0,
        },
      })

      const event = {
        httpMethod: 'GET',
        resource: '/letters/{date}',
        pathParameters: { date: '2016-02-10' },
      }

      const response = await handle(event, {})

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.date).toBe('2016-02-10')
      expect(body.title).toBe('Family Update')
      expect(body.content).toBe('Dear Family...')
      expect(body.pdfKey).toBe('letters/2016-02-10.pdf')
    })

    it('should return 404 for missing letter', async () => {
      ddbMock.on(GetCommand).resolves({ Item: null })

      const event = {
        httpMethod: 'GET',
        resource: '/letters/{date}',
        pathParameters: { date: '2016-02-10' },
      }

      const response = await handle(event, {})

      expect(response.statusCode).toBe(404)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Letter not found')
    })

    it('should validate date format', async () => {
      const event = {
        httpMethod: 'GET',
        resource: '/letters/{date}',
        pathParameters: { date: 'invalid-date' },
      }

      const response = await handle(event, {})

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('Valid date parameter required')
    })

    it('should accept date with slug suffix', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          PK: 'LETTER#2016-02-10-family-update',
          SK: 'CURRENT',
          title: 'Family Update',
          content: 'Dear Family...',
        },
      })

      const event = {
        httpMethod: 'GET',
        resource: '/letters/{date}',
        pathParameters: { date: '2016-02-10-family-update' },
      }

      const response = await handle(event, {})

      expect(response.statusCode).toBe(200)
    })
  })

  describe('PUT /letters/{date}', () => {
    it('should update letter and create version', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          PK: 'LETTER#2016-02-10',
          SK: 'CURRENT',
          title: 'Original Title',
          content: 'Original content',
          versionCount: 0,
          updatedAt: '2025-01-15T10:00:00.000Z',
          lastEditedBy: null,
        },
      })
      ddbMock.on(PutCommand).resolves({})
      ddbMock.on(UpdateCommand).resolves({})

      const event = {
        httpMethod: 'PUT',
        resource: '/letters/{date}',
        pathParameters: { date: '2016-02-10' },
        body: JSON.stringify({
          content: 'Updated content',
          title: 'Updated Title',
        }),
      }

      const response = await handle(event, { requesterId: 'user-123' })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.content).toBe('Updated content')
      expect(body.title).toBe('Updated Title')
      expect(body.versionCount).toBe(1)

      // Verify version was created
      const putCalls = ddbMock.commandCalls(PutCommand)
      expect(putCalls).toHaveLength(1)
      expect(putCalls[0].args[0].input.Item.entityType).toBe('LETTER_VERSION')
    })

    it('should require content', async () => {
      const event = {
        httpMethod: 'PUT',
        resource: '/letters/{date}',
        pathParameters: { date: '2016-02-10' },
        body: JSON.stringify({}),
      }

      const response = await handle(event, { requesterId: 'user-123' })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Content is required')
    })

    it('should require authentication', async () => {
      const event = {
        httpMethod: 'PUT',
        resource: '/letters/{date}',
        pathParameters: { date: '2016-02-10' },
        body: JSON.stringify({ content: 'New content' }),
      }

      const response = await handle(event, {})

      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Authentication required')
    })

    it('should return 404 for non-existent letter', async () => {
      ddbMock.on(GetCommand).resolves({ Item: null })

      const event = {
        httpMethod: 'PUT',
        resource: '/letters/{date}',
        pathParameters: { date: '2016-02-10' },
        body: JSON.stringify({ content: 'New content' }),
      }

      const response = await handle(event, { requesterId: 'user-123' })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('GET /letters/{date}/versions', () => {
    it('should return list of versions', async () => {
      ddbMock.on(QueryCommand).resolves({
        Items: [
          {
            PK: 'LETTER#2016-02-10',
            SK: 'VERSION#2025-01-15T12:00:00.000Z',
            versionNumber: 2,
            editedBy: 'user-123',
            editedAt: '2025-01-15T11:00:00.000Z',
          },
          {
            PK: 'LETTER#2016-02-10',
            SK: 'VERSION#2025-01-15T10:00:00.000Z',
            versionNumber: 1,
            editedBy: 'user-456',
            editedAt: '2025-01-15T09:00:00.000Z',
          },
        ],
      })

      const event = {
        httpMethod: 'GET',
        resource: '/letters/{date}/versions',
        pathParameters: { date: '2016-02-10' },
      }

      const response = await handle(event, {})

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.versions).toHaveLength(2)
      expect(body.versions[0].timestamp).toBe('2025-01-15T12:00:00.000Z')
      expect(body.versions[0].versionNumber).toBe(2)
    })

    it('should return empty list for letter with no edits', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] })

      const event = {
        httpMethod: 'GET',
        resource: '/letters/{date}/versions',
        pathParameters: { date: '2016-02-10' },
      }

      const response = await handle(event, {})

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.versions).toHaveLength(0)
    })
  })

  describe('POST /letters/{date}/revert', () => {
    it('should revert to specified version', async () => {
      // First call: get version to revert to
      ddbMock.on(GetCommand)
        .resolvesOnce({
          Item: {
            PK: 'LETTER#2016-02-10',
            SK: 'VERSION#2025-01-15T10:00:00.000Z',
            content: 'Old content',
            title: 'Old Title',
            versionNumber: 1,
          },
        })
        // Second call: get current letter
        .resolvesOnce({
          Item: {
            PK: 'LETTER#2016-02-10',
            SK: 'CURRENT',
            content: 'Current content',
            title: 'Current Title',
            versionCount: 2,
            updatedAt: '2025-01-15T12:00:00.000Z',
            lastEditedBy: 'user-123',
          },
        })

      ddbMock.on(PutCommand).resolves({})
      ddbMock.on(UpdateCommand).resolves({})

      const event = {
        httpMethod: 'POST',
        resource: '/letters/{date}/revert',
        pathParameters: { date: '2016-02-10' },
        body: JSON.stringify({ versionTimestamp: '2025-01-15T10:00:00.000Z' }),
      }

      const response = await handle(event, { requesterId: 'user-789' })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.message).toBe('Reverted successfully')
      expect(body.content).toBe('Old content')
      expect(body.title).toBe('Old Title')
      expect(body.versionCount).toBe(3)
    })

    it('should return 404 for invalid version', async () => {
      ddbMock.on(GetCommand).resolves({ Item: null })

      const event = {
        httpMethod: 'POST',
        resource: '/letters/{date}/revert',
        pathParameters: { date: '2016-02-10' },
        body: JSON.stringify({ versionTimestamp: '2025-01-15T10:00:00.000Z' }),
      }

      const response = await handle(event, { requesterId: 'user-123' })

      expect(response.statusCode).toBe(404)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Version not found')
    })

    it('should require authentication', async () => {
      const event = {
        httpMethod: 'POST',
        resource: '/letters/{date}/revert',
        pathParameters: { date: '2016-02-10' },
        body: JSON.stringify({ versionTimestamp: '2025-01-15T10:00:00.000Z' }),
      }

      const response = await handle(event, {})

      expect(response.statusCode).toBe(401)
    })

    it('should require versionTimestamp', async () => {
      const event = {
        httpMethod: 'POST',
        resource: '/letters/{date}/revert',
        pathParameters: { date: '2016-02-10' },
        body: JSON.stringify({}),
      }

      const response = await handle(event, { requesterId: 'user-123' })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('versionTimestamp is required')
    })
  })

  describe('GET /letters/{date}/pdf', () => {
    it('should return presigned URL for PDF', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          PK: 'LETTER#2016-02-10',
          SK: 'CURRENT',
          pdfKey: 'letters/2016-02-10.pdf',
        },
      })

      // Mock S3 presigner - the actual presigning happens via s3-request-presigner
      // Since we're using the mock, we can verify the call was made

      const event = {
        httpMethod: 'GET',
        resource: '/letters/{date}/pdf',
        pathParameters: { date: '2016-02-10' },
      }

      const response = await handle(event, {})

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.downloadUrl).toBeDefined()
      expect(body.filename).toBe('2016-02-10.pdf')
    })

    it('should return 404 if letter has no PDF', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          PK: 'LETTER#2016-02-10',
          SK: 'CURRENT',
          pdfKey: null,
        },
      })

      const event = {
        httpMethod: 'GET',
        resource: '/letters/{date}/pdf',
        pathParameters: { date: '2016-02-10' },
      }

      const response = await handle(event, {})

      expect(response.statusCode).toBe(404)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('PDF not found')
    })

    it('should return 404 if letter not found', async () => {
      ddbMock.on(GetCommand).resolves({ Item: null })

      const event = {
        httpMethod: 'GET',
        resource: '/letters/{date}/pdf',
        pathParameters: { date: '2016-02-10' },
      }

      const response = await handle(event, {})

      expect(response.statusCode).toBe(404)
    })
  })
})
