/**
 * Database configuration and clients
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'

// Shared DynamoDB clients
const client = new DynamoDBClient({})
export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
})

// Single table name from environment
export const TABLE_NAME = process.env.TABLE_NAME || process.env.DYNAMODB_TABLE || ''

// S3 archive bucket (single bucket for all storage)
export const ARCHIVE_BUCKET = process.env.ARCHIVE_BUCKET || ''

// S3 prefixes within archive bucket
export const S3_PREFIXES = {
  letters: 'letters/',
  media: 'media/',
  profilePhotos: 'profile-photos/',
  temp: 'temp/',
} as const

export type S3PrefixKey = keyof typeof S3_PREFIXES
