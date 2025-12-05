#!/usr/bin/env node
/**
 * DynamoDB Letter Population Script
 * Populates DynamoDB with letter metadata from migrated S3 files.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb'
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand
} from '@aws-sdk/client-s3'

// Clients
const ddbClient = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(ddbClient)
const s3Client = new S3Client({})

/**
 * Convert a readable stream to string
 */
async function streamToString(stream) {
  const chunks = []
  for await (const chunk of stream) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf-8')
}

/**
 * Extract title from markdown content
 * Looks for first heading (# Title) or uses first non-empty line
 */
function extractTitle(content) {
  const lines = content.split('\n')

  // Look for heading
  for (const line of lines) {
    const headingMatch = line.match(/^#+\s+(.+)$/)
    if (headingMatch) {
      return headingMatch[1].trim()
    }
  }

  // Use first non-empty line as fallback
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('---')) {
      // Remove any date prefix patterns
      return trimmed.replace(/^[A-Za-z]+\.?\s*\d{1,2}\.?\s*,?\s*\d{4}\s*[-–—]?\s*/i, '').trim() || trimmed
    }
  }

  return 'Untitled Letter'
}

/**
 * Extract date from filename
 * Expected format: YYYY-MM-DD.md or YYYY-MM-DD-slug.md
 */
function extractDateFromFilename(filename) {
  const match = filename.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : null
}

/**
 * Extract full date key (including slug if present)
 */
function extractDateKey(filename) {
  // Remove extension
  const basename = filename.replace(/\.(md|pdf)$/, '')
  return basename
}

/**
 * List all letter files in S3
 */
async function listLetterFiles(bucket, prefix) {
  const files = { markdown: {}, pdf: {} }
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
        if (!item.Key) continue

        const filename = item.Key.replace(prefix, '')
        if (!filename) continue

        const dateKey = extractDateKey(filename)

        if (filename.endsWith('.md')) {
          files.markdown[dateKey] = item.Key
        } else if (filename.endsWith('.pdf')) {
          files.pdf[dateKey] = item.Key
        }
      }
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined
  } while (continuationToken)

  return files
}

/**
 * Get markdown content from S3
 */
async function getMarkdownContent(bucket, key) {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key
  })

  const response = await s3Client.send(command)
  return streamToString(response.Body)
}

/**
 * Check if letter already exists in DynamoDB
 */
async function letterExists(tableName, dateKey) {
  const result = await docClient.send(new GetCommand({
    TableName: tableName,
    Key: {
      PK: `LETTER#${dateKey}`,
      SK: 'CURRENT'
    },
    ProjectionExpression: 'PK'
  }))

  return !!result.Item
}

/**
 * Create DynamoDB item for a letter
 */
function createLetterItem(dateKey, content, title, pdfKey, originalTitle) {
  const now = new Date().toISOString()
  const date = extractDateFromFilename(dateKey) || dateKey

  return {
    PK: `LETTER#${dateKey}`,
    SK: 'CURRENT',
    GSI1PK: 'LETTERS',
    GSI1SK: date, // Use just the date portion for sorting
    content,
    title,
    originalTitle: originalTitle || title,
    pdfKey: pdfKey || null,
    createdAt: now,
    updatedAt: now,
    versionCount: 0,
    lastEditedBy: null,
    entityType: 'LETTER'
  }
}

/**
 * Batch write items to DynamoDB
 */
async function batchWriteItems(tableName, items) {
  // DynamoDB batch write supports max 25 items
  const batches = []
  for (let i = 0; i < items.length; i += 25) {
    batches.push(items.slice(i, i + 25))
  }

  for (const batch of batches) {
    const command = new BatchWriteCommand({
      RequestItems: {
        [tableName]: batch.map(item => ({
          PutRequest: { Item: item }
        }))
      }
    })

    await docClient.send(command)
  }
}

/**
 * Process a single letter
 */
async function processLetter(bucket, prefix, dateKey, mdKey, pdfKey, tableName, options) {
  const { dryRun, skipExisting, verbose } = options

  const result = {
    dateKey,
    success: false,
    skipped: false
  }

  try {
    // Check if already exists
    if (skipExisting) {
      const exists = await letterExists(tableName, dateKey)
      if (exists) {
        result.skipped = true
        result.success = true
        result.message = 'Already exists'
        return result
      }
    }

    // Get markdown content
    const content = await getMarkdownContent(bucket, mdKey)

    // Extract title
    const title = extractTitle(content)

    // Create DynamoDB item
    const item = createLetterItem(
      dateKey,
      content,
      title,
      pdfKey,
      null // originalTitle could be passed from migration report
    )

    if (verbose) {
      console.log(`  Title: ${title}`)
      console.log(`  PDF: ${pdfKey ? 'Yes' : 'No'}`)
    }

    // Write to DynamoDB (unless dry-run)
    if (!dryRun) {
      await docClient.send(new PutCommand({
        TableName: tableName,
        Item: item
      }))
    }

    result.success = true
    result.title = title
    result.hasPdf = !!pdfKey

  } catch (error) {
    result.error = error.message
  }

  return result
}

/**
 * Run the population
 */
export async function runPopulation(options) {
  const {
    bucket,
    prefix = 'letters/',
    tableName,
    dryRun = false,
    skipExisting = true,
    verbose = false
  } = options

  if (verbose) {
    console.log(`Populating DynamoDB from s3://${bucket}/${prefix}`)
    console.log(`Table: ${tableName}`)
    if (dryRun) console.log('DRY RUN - no items will be written')
    if (skipExisting) console.log('Skipping existing letters')
  }

  // List all letter files
  const files = await listLetterFiles(bucket, prefix)
  const dateKeys = Object.keys(files.markdown)

  if (verbose) {
    console.log(`Found ${dateKeys.length} markdown files`)
  }

  // Process each letter
  const results = []

  for (const dateKey of dateKeys) {
    if (verbose) {
      console.log(`\nProcessing: ${dateKey}`)
    }

    const result = await processLetter(
      bucket,
      prefix,
      dateKey,
      files.markdown[dateKey],
      files.pdf[dateKey] || null,
      tableName,
      { dryRun, skipExisting, verbose }
    )

    results.push(result)

    if (verbose) {
      if (result.skipped) {
        console.log(`  ⏭ Skipped (already exists)`)
      } else if (result.success) {
        console.log(`  ✓ Populated`)
      } else {
        console.log(`  ✗ Error: ${result.error}`)
      }
    }
  }

  // Generate report
  const successful = results.filter(r => r.success && !r.skipped)
  const skipped = results.filter(r => r.skipped)
  const failed = results.filter(r => !r.success)

  const report = {
    total: results.length,
    populated: successful.length,
    skipped: skipped.length,
    failed: failed.length,
    successes: successful.map(r => ({
      dateKey: r.dateKey,
      title: r.title,
      hasPdf: r.hasPdf
    })),
    failures: failed.map(r => ({
      dateKey: r.dateKey,
      error: r.error
    }))
  }

  if (verbose) {
    console.log(`\nPopulation complete:`)
    console.log(`  Total: ${report.total}`)
    console.log(`  Populated: ${report.populated}`)
    console.log(`  Skipped: ${report.skipped}`)
    console.log(`  Failed: ${report.failed}`)
  }

  return report
}

/**
 * Parse command line arguments
 */
function parseArgs(args) {
  const options = {
    bucket: null,
    prefix: 'letters/',
    tableName: null,
    region: null,
    dryRun: false,
    skipExisting: true,
    forceAll: false,
    verbose: false,
    outputFile: null
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    switch (arg) {
      case '--bucket':
        options.bucket = args[++i]
        break
      case '--prefix':
        options.prefix = args[++i]
        break
      case '--table':
        options.tableName = args[++i]
        break
      case '--region':
        options.region = args[++i]
        break
      case '--dry-run':
        options.dryRun = true
        break
      case '--force-all':
        options.forceAll = true
        options.skipExisting = false
        break
      case '--verbose':
      case '-v':
        options.verbose = true
        break
      case '--output':
      case '-o':
        options.outputFile = args[++i]
        break
      case '--help':
      case '-h':
        console.log(`
DynamoDB Letter Population Script

Usage: node populate-letters-db.js [options]

Options:
  --bucket <name>     S3 bucket containing letters (required)
  --prefix <path>     S3 prefix (default: letters/)
  --table <name>      DynamoDB table name (required)
  --region <region>   AWS region
  --dry-run           Don't write to DynamoDB, just report what would happen
  --force-all         Overwrite existing letters (default: skip existing)
  --verbose, -v       Show progress output
  --output, -o <file> Write report to JSON file
  --help, -h          Show this help
`)
        process.exit(0)
    }
  }

  return options
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArgs(process.argv.slice(2))

  if (!options.bucket || !options.tableName) {
    console.error('Error: --bucket and --table are required')
    process.exit(1)
  }

  runPopulation(options)
    .then(async report => {
      if (options.outputFile) {
        const fs = await import('fs/promises')
        await fs.writeFile(options.outputFile, JSON.stringify(report, null, 2))
        console.log(`Report written to ${options.outputFile}`)
      }

      if (report.failed > 0) {
        process.exit(1)
      }
    })
    .catch(error => {
      console.error('Population failed:', error)
      process.exit(1)
    })
}
