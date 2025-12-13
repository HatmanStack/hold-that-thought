#!/usr/bin/env node
/**
 * Populate DynamoDB from letter archive JSON files
 *
 * Reads letter.json files from S3 archive and populates DynamoDB table.
 * Used when creating a new stack or restoring from backup.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3'

const ddbClient = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(ddbClient)
const s3Client = new S3Client({})

async function streamToString(stream) {
  const chunks = []
  for await (const chunk of stream) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf-8')
}

/**
 * List all letter.json files in archive
 */
async function listLetterJsonFiles(bucket, prefix) {
  const files = []
  let continuationToken = undefined

  do {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken
    })

    const response = await s3Client.send(command)

    if (response.Contents) {
      for (const item of response.Contents) {
        // Match date-based JSON files: letters/YYYY-MM-DD/YYYY-MM-DD.json
        if (item.Key && /\/\d{4}-\d{2}-\d{2}(_\d+)?\/\d{4}-\d{2}-\d{2}(_\d+)?\.json$/.test(item.Key)) {
          files.push(item.Key)
        }
      }
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined
  } while (continuationToken)

  return files
}

/**
 * Read letter JSON from S3
 */
async function readLetterJson(bucket, key) {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key
  })

  const response = await s3Client.send(command)
  const content = await streamToString(response.Body)
  return JSON.parse(content)
}

/**
 * Create DynamoDB item from letter data
 * @param {Object} letterData - Parsed JSON data
 * @param {string} jsonKey - S3 key of the JSON file (used to derive pdfKey)
 */
function createDynamoItem(letterData, jsonKey) {
  const now = new Date().toISOString()
  // Derive pdfKey from jsonKey: letters/2008-05-20/2008-05-20.json -> letters/2008-05-20/2008-05-20.pdf
  const pdfKey = letterData.pdfKey || jsonKey.replace(/\.json$/, '.pdf')

  return {
    PK: `LETTER#${letterData.date}`,
    SK: 'CURRENT',
    GSI1PK: 'LETTERS',
    GSI1SK: letterData.date,
    title: letterData.title,
    author: letterData.author || null,
    description: letterData.description || null,
    content: letterData.content,
    pdfKey: pdfKey,
    createdAt: now,
    updatedAt: now,
    versionCount: 0,
    lastEditedBy: null,
    entityType: 'LETTER'
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2)

  // Parse arguments
  let bucket = 'hold-that-thought-archive'
  let prefix = 'letters/'
  let tableName = 'htthough-test'
  const dryRun = args.includes('--dry-run')
  const verbose = args.includes('--verbose') || args.includes('-v')

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--bucket') bucket = args[++i]
    if (args[i] === '--prefix') prefix = args[++i]
    if (args[i] === '--table') tableName = args[++i]
  }

  console.log('Populating DynamoDB from archive...')
  console.log(`Source: s3://${bucket}/${prefix}`)
  console.log(`Table: ${tableName}`)
  if (dryRun) console.log('DRY RUN - no items will be written')
  console.log('')

  // List letter JSON files
  console.log('Listing letter.json files...')
  const jsonFiles = await listLetterJsonFiles(bucket, prefix)
  console.log(`Found ${jsonFiles.length} letters\n`)

  // Process each letter
  let successful = 0
  let failed = 0

  for (const jsonKey of jsonFiles) {
    try {
      const letterData = await readLetterJson(bucket, jsonKey)

      if (verbose) {
        console.log(`Processing: ${letterData.date} - ${letterData.title}`)
      }

      if (!dryRun) {
        const item = createDynamoItem(letterData, jsonKey)
        await docClient.send(new PutCommand({
          TableName: tableName,
          Item: item
        }))
      }

      if (verbose) {
        console.log(`  ✓ ${dryRun ? 'Would populate' : 'Populated'}`)
      }

      successful++
    } catch (err) {
      console.error(`  ✗ Error processing ${jsonKey}: ${err.message}`)
      failed++
    }
  }

  console.log('\nPopulation complete:')
  console.log(`  Total: ${jsonFiles.length}`)
  console.log(`  Successful: ${successful}`)
  console.log(`  Failed: ${failed}`)
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
