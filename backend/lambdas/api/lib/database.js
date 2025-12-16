/**
 * Database configuration and clients
 * @module lib/database
 */
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb')

// Shared DynamoDB clients
const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)

// Single table name from environment
const TABLE_NAME = process.env.TABLE_NAME || process.env.DYNAMODB_TABLE

// S3 archive bucket (single bucket for all storage)
const ARCHIVE_BUCKET = process.env.ARCHIVE_BUCKET

// S3 prefixes within archive bucket
const S3_PREFIXES = {
  letters: 'letters/',
  media: 'media/',
  profilePhotos: 'profile-photos/',
  temp: 'temp/',
}

module.exports = {
  docClient,
  TABLE_NAME,
  ARCHIVE_BUCKET,
  S3_PREFIXES,
}
