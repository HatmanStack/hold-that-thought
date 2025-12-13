const { mockClient } = require('aws-sdk-client-mock')
const { S3Client, PutObjectCommand, CopyObjectCommand } = require('@aws-sdk/client-s3')
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda')
const { DynamoDBDocumentClient, ScanCommand, GetCommand, DeleteCommand, PutCommand } = require('@aws-sdk/lib-dynamodb')

// Set env vars before require
process.env.TABLE_NAME = 'test-table'
process.env.ARCHIVE_BUCKET = 'test-bucket'
process.env.LETTER_PROCESSOR_FUNCTION_NAME = 'test-processor'

// Mock presigner
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://mock-s3-url.com')
}))

const s3Mock = mockClient(S3Client)
const lambdaMock = mockClient(LambdaClient)
const ddbMock = mockClient(DynamoDBDocumentClient)

const { handler } = require('../../backend/lambdas/api/index')

beforeEach(() => {
  s3Mock.reset()
  lambdaMock.reset()
  ddbMock.reset()
})

describe('Drafts API', () => {
  const adminContext = {
    claims: {
      sub: 'admin-1',
      email: 'admin@example.com',
      'cognito:groups': 'Admins'
    }
  }

  const userContext = {
    claims: {
      sub: 'user-1',
      email: 'user@example.com'
    }
  }

  describe('POST /letters/upload-request', () => {
    it('should return presigned URLs', async () => {
      const event = {
        httpMethod: 'POST',
        path: '/letters/upload-request',
        body: JSON.stringify({ fileCount: 2 }),
        requestContext: { authorizer: adminContext }
      }

      const response = await handler(event)
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.uploadId).toBeDefined()
      expect(body.urls).toHaveLength(2)
      expect(body.urls[0].url).toContain('https://test-bucket.s3.')
    })
  })

  describe('POST /letters/process/{uploadId}', () => {
    it('should invoke processor lambda', async () => {
      lambdaMock.on(InvokeCommand).resolves({})

      const event = {
        httpMethod: 'POST',
        path: '/letters/process/123-abc',
        requestContext: { authorizer: adminContext }
      }

      const response = await handler(event)
      expect(response.statusCode).toBe(202)
      expect(lambdaMock.calls()).toHaveLength(1)
      const call = lambdaMock.call(0)
      const input = call.args[0].input
      expect(input.FunctionName).toBe('test-processor')
      const payload = JSON.parse(input.Payload)
      expect(payload.uploadId).toBe('123-abc')
    })
  })

  describe('GET /admin/drafts', () => {
    it('should list drafts for admin', async () => {
      ddbMock.on(ScanCommand).resolves({
        Items: [{ PK: 'DRAFT#1', status: 'REVIEW' }]
      })

      const event = {
        httpMethod: 'GET',
        path: '/admin/drafts',
        requestContext: { authorizer: adminContext }
      }

      const response = await handler(event)
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.drafts).toHaveLength(1)
    })

    it('should deny non-admin', async () => {
      const event = {
        httpMethod: 'GET',
        path: '/admin/drafts',
        requestContext: { authorizer: userContext }
      }

      const response = await handler(event)
      expect(response.statusCode).toBe(403)
    })
  })

  describe('GET /admin/drafts/{draftId}', () => {
    it('should get draft details', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: { PK: 'DRAFT#1', status: 'REVIEW' }
      })

      const event = {
        httpMethod: 'GET',
        path: '/admin/drafts/1',
        requestContext: { authorizer: adminContext }
      }

      const response = await handler(event)
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.PK).toBe('DRAFT#1')
    })
  })

  describe('DELETE /admin/drafts/{draftId}', () => {
    it('should delete draft', async () => {
      ddbMock.on(DeleteCommand).resolves({})

      const event = {
        httpMethod: 'DELETE',
        path: '/admin/drafts/1',
        requestContext: { authorizer: adminContext }
      }

      const response = await handler(event)
      expect(response.statusCode).toBe(200)
    })
  })

  describe('POST /admin/drafts/{draftId}/publish', () => {
    it('should publish draft', async () => {
      // Mock Draft Get
      ddbMock.on(GetCommand).resolves({
        Item: { PK: 'DRAFT#1', s3Key: 'temp/1/combined.pdf' }
      })
      // Mock S3 Copy/Put
      s3Mock.on(CopyObjectCommand).resolves({})
      s3Mock.on(PutObjectCommand).resolves({})
      // Mock DB Put/Delete
      ddbMock.on(PutCommand).resolves({})
      ddbMock.on(DeleteCommand).resolves({})

      const event = {
        httpMethod: 'POST',
        path: '/admin/drafts/1/publish',
        body: JSON.stringify({
          finalData: {
            date: '2020-01-01',
            title: 'Test Letter',
            content: 'Hello'
          }
        }),
        requestContext: { authorizer: adminContext }
      }

      const response = await handler(event)
      expect(response.statusCode).toBe(200)
      
      // Verify Letter Saved
      const putCalls = ddbMock.calls().filter(c => c.args[0] instanceof PutCommand)
      expect(putCalls).toHaveLength(1)
      const item = putCalls[0].args[0].input.Item
      expect(item.PK).toBe('LETTER#2020-01-01')
      expect(item.pdfKey).toContain('2020-01-01/2020-01-01.pdf')
    })
  })
})
