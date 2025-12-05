#!/usr/bin/env node
/**
 * Migration Validation Script
 * Validates the letter migration by checking file structure and content.
 */

import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'

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
 * Validate the letter migration
 *
 * @param {Object} options - Validation options
 * @param {string} options.bucket - Bucket to validate
 * @param {string} options.prefix - Prefix to check (default: 'letters/')
 * @param {boolean} options.verbose - Show detailed output
 * @returns {Promise<Object>} Validation results
 */
export async function validateLetterMigration(options) {
  const {
    bucket,
    prefix = 'letters/',
    verbose = false
  } = options

  if (verbose) {
    console.log(`Validating letter migration in ${bucket}/${prefix}`)
  }

  const results = {
    valid: true,
    totalFiles: 0,
    mdFiles: [],
    pdfFiles: [],
    orphanedMd: [],
    orphanedPdf: [],
    hasNoFrontmatter: 0,
    hasFrontmatter: [],
    invalidDateFormat: [],
    errors: []
  }

  // List all files in the letters prefix
  let continuationToken = undefined
  const allFiles = []

  do {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken
    })

    const response = await s3Client.send(command)
    if (response.Contents) {
      allFiles.push(...response.Contents.map(c => c.Key))
    }
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined
  } while (continuationToken)

  results.totalFiles = allFiles.length

  // Separate md and pdf files
  for (const key of allFiles) {
    if (key.endsWith('.md')) {
      results.mdFiles.push(key)
    } else if (key.endsWith('.pdf')) {
      results.pdfFiles.push(key)
    }
  }

  if (verbose) {
    console.log(`Found ${results.mdFiles.length} markdown files and ${results.pdfFiles.length} PDF files`)
  }

  // Check each markdown file
  for (const mdKey of results.mdFiles) {
    const baseName = mdKey.slice(0, -3) // Remove .md
    const expectedPdf = `${baseName}.pdf`

    // Check for matching PDF
    if (!results.pdfFiles.includes(expectedPdf)) {
      results.orphanedMd.push(mdKey)
    }

    // Validate date format in filename
    const filename = mdKey.split('/').pop()
    const dateMatch = filename.match(/^(\d{4}-\d{2}-\d{2})/)
    if (!dateMatch) {
      results.invalidDateFormat.push(mdKey)
    }

    // Check for frontmatter
    try {
      const getCommand = new GetObjectCommand({
        Bucket: bucket,
        Key: mdKey
      })
      const response = await s3Client.send(getCommand)
      const content = await streamToString(response.Body)

      if (content.startsWith('---')) {
        results.hasFrontmatter.push(mdKey)
        results.valid = false
      } else {
        results.hasNoFrontmatter++
      }
    } catch (error) {
      results.errors.push({ key: mdKey, error: error.message })
    }

    if (verbose && results.mdFiles.indexOf(mdKey) % 10 === 0) {
      console.log(`Validated ${results.mdFiles.indexOf(mdKey) + 1}/${results.mdFiles.length} files...`)
    }
  }

  // Check for orphaned PDFs
  for (const pdfKey of results.pdfFiles) {
    const baseName = pdfKey.slice(0, -4) // Remove .pdf
    const expectedMd = `${baseName}.md`

    if (!results.mdFiles.includes(expectedMd)) {
      results.orphanedPdf.push(pdfKey)
    }
  }

  // Set overall validity
  if (results.orphanedMd.length > 0 || results.hasFrontmatter.length > 0 || results.invalidDateFormat.length > 0) {
    results.valid = false
  }

  if (verbose) {
    console.log('\n=== Validation Results ===')
    console.log(`Overall Valid: ${results.valid}`)
    console.log(`Total Files: ${results.totalFiles}`)
    console.log(`Markdown Files: ${results.mdFiles.length}`)
    console.log(`PDF Files: ${results.pdfFiles.length}`)
    console.log(`Files with Frontmatter Stripped: ${results.hasNoFrontmatter}`)

    if (results.hasFrontmatter.length > 0) {
      console.log(`\n⚠️  Files still containing frontmatter: ${results.hasFrontmatter.length}`)
      results.hasFrontmatter.slice(0, 5).forEach(f => console.log(`   - ${f}`))
    }

    if (results.orphanedMd.length > 0) {
      console.log(`\n⚠️  Markdown files without matching PDF: ${results.orphanedMd.length}`)
      results.orphanedMd.slice(0, 5).forEach(f => console.log(`   - ${f}`))
    }

    if (results.orphanedPdf.length > 0) {
      console.log(`\n⚠️  PDF files without matching markdown: ${results.orphanedPdf.length}`)
      results.orphanedPdf.slice(0, 5).forEach(f => console.log(`   - ${f}`))
    }

    if (results.invalidDateFormat.length > 0) {
      console.log(`\n⚠️  Files with invalid date format: ${results.invalidDateFormat.length}`)
      results.invalidDateFormat.slice(0, 5).forEach(f => console.log(`   - ${f}`))
    }
  }

  return results
}

/**
 * Parse command line arguments
 */
function parseArgs(args) {
  const options = {
    bucket: null,
    prefix: 'letters/',
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
Migration Validation Script

Usage: node validate-migration.js [options]

Options:
  --bucket <name>      S3 bucket to validate (required)
  --prefix <path>      Prefix to check (default: letters/)
  --verbose, -v        Show detailed output
  --output, -o <file>  Write report to JSON file
  --help, -h           Show this help
`)
        process.exit(0)
    }
  }

  return options
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArgs(process.argv.slice(2))

  if (!options.bucket) {
    console.error('Error: --bucket is required')
    process.exit(1)
  }

  validateLetterMigration(options)
    .then(async results => {
      if (options.outputFile) {
        const fs = await import('fs/promises')
        await fs.writeFile(options.outputFile, JSON.stringify(results, null, 2))
        console.log(`Report written to ${options.outputFile}`)
      }

      if (!results.valid) {
        console.error('\n❌ Validation failed')
        process.exit(1)
      } else {
        console.log('\n✅ Validation passed')
      }
    })
    .catch(error => {
      console.error('Validation failed:', error)
      process.exit(1)
    })
}
