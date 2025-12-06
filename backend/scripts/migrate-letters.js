#!/usr/bin/env node
/**
 * Letter Migration Script
 * Migrates letters from old S3 bucket structure to new archive bucket
 * with date-based naming convention.
 */

import { extractDate } from './lib/date-parser.js'
import { stripFrontmatter, extractFrontmatter } from './lib/frontmatter-stripper.js'
import { listLetterFolders, getLetterFiles, copyFile, uploadContent } from './lib/s3-operations.js'
import { generateUniqueFilename } from './lib/slug-generator.js'

/**
 * Process a single letter folder
 *
 * @param {string} sourceBucket - Source bucket name
 * @param {string} folderPath - Full folder path
 * @param {string} destBucket - Destination bucket name
 * @param {string} destPrefix - Destination prefix (e.g., 'letters/')
 * @param {Set<string>} existingDates - Set of already-used date prefixes
 * @param {boolean} dryRun - If true, don't actually copy files
 * @returns {Promise<Object>} Result object with success status and details
 */
export async function processLetter(sourceBucket, folderPath, destBucket, destPrefix, existingDates, dryRun = false) {
  const result = {
    folder: folderPath.split('/').filter(Boolean).pop(),
    folderPath,
    success: false,
    dryRun
  }

  try {
    // Get markdown and PDF from folder
    const files = await getLetterFiles(sourceBucket, folderPath)

    if (!files.markdown) {
      result.error = 'No markdown file found in folder'
      return result
    }

    // Extract date from markdown content
    const date = extractDate(files.markdown)
    if (!date) {
      result.error = 'Could not extract date from letter content'
      result.markdownPreview = files.markdown.substring(0, 200)
      return result
    }

    result.date = date

    // Extract original metadata from frontmatter
    const frontmatter = extractFrontmatter(files.markdown)
    result.originalTitle = frontmatter.title || files.folderName

    // Strip frontmatter from content
    const cleanContent = stripFrontmatter(files.markdown)

    // Generate unique filename
    const filenames = generateUniqueFilename(date, result.originalTitle, existingDates)
    result.mdFile = filenames.md
    result.pdfFile = filenames.pdf

    // Copy/upload files (unless dry-run)
    if (!dryRun) {
      // Upload cleaned markdown
      await uploadContent(
        destBucket,
        `${destPrefix}${filenames.md}`,
        cleanContent,
        'text/markdown'
      )

      // Copy PDF if exists
      if (files.pdfKey) {
        await copyFile(
          sourceBucket,
          files.pdfKey,
          destBucket,
          `${destPrefix}${filenames.pdf}`
        )
        result.pdfCopied = true
      } else {
        result.pdfCopied = false
      }
    }

    result.success = true
    return result
  } catch (error) {
    result.error = error.message
    return result
  }
}

/**
 * Generate migration report from results
 *
 * @param {Array<Object>} results - Array of processLetter results
 * @returns {Object} Report summary
 */
export function generateReport(results) {
  const successful = results.filter(r => r.success)
  const failed = results.filter(r => !r.success)

  return {
    total: results.length,
    successful: successful.length,
    failed: failed.length,
    successes: successful.map(r => ({
      folder: r.folder,
      date: r.date,
      mdFile: r.mdFile,
      pdfCopied: r.pdfCopied
    })),
    failures: failed.map(r => ({
      folder: r.folder,
      error: r.error,
      markdownPreview: r.markdownPreview
    }))
  }
}

/**
 * Run the full migration
 *
 * @param {Object} options - Migration options
 * @param {string} options.sourceBucket - Source bucket name
 * @param {string} options.sourcePrefix - Source prefix (default: 'urara/')
 * @param {string} options.destBucket - Destination bucket name
 * @param {string} options.destPrefix - Destination prefix (default: 'letters/')
 * @param {boolean} options.dryRun - If true, don't actually copy files
 * @param {boolean} options.verbose - If true, log progress
 * @returns {Promise<Object>} Migration report
 */
export async function runMigration(options) {
  const {
    sourceBucket,
    sourcePrefix = 'letters/',
    destBucket,
    destPrefix = 'letters/',
    dryRun = false,
    verbose = false
  } = options

  if (verbose) {
    console.log(`Starting migration from ${sourceBucket}/${sourcePrefix} to ${destBucket}/${destPrefix}`)
    if (dryRun) console.log('DRY RUN - no files will be modified')
  }

  // List all letter folders
  const folders = await listLetterFolders(sourceBucket, sourcePrefix)
  if (verbose) {
    console.log(`Found ${folders.length} letter folders`)
  }

  // Process each folder
  const existingDates = new Set()
  const results = []

  for (const folder of folders) {
    if (verbose) {
      console.log(`Processing: ${folder}`)
    }

    const result = await processLetter(
      sourceBucket,
      folder,
      destBucket,
      destPrefix,
      existingDates,
      dryRun
    )

    results.push(result)

    if (verbose) {
      if (result.success) {
        console.log(`  ✓ ${result.date} -> ${result.mdFile}`)
      } else {
        console.log(`  ✗ Error: ${result.error}`)
      }
    }
  }

  // Generate and return report
  const report = generateReport(results)

  if (verbose) {
    console.log(`\nMigration complete:`)
    console.log(`  Total: ${report.total}`)
    console.log(`  Successful: ${report.successful}`)
    console.log(`  Failed: ${report.failed}`)
  }

  return report
}

/**
 * Parse command line arguments
 */
function parseArgs(args) {
  const options = {
    sourceBucket: null,
    sourcePrefix: 'letters/',
    destBucket: null,
    destPrefix: 'letters/',
    dryRun: false,
    verbose: false,
    outputFile: null
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    switch (arg) {
      case '--source-bucket':
        options.sourceBucket = args[++i]
        break
      case '--source-prefix':
        options.sourcePrefix = args[++i]
        break
      case '--dest-bucket':
        options.destBucket = args[++i]
        break
      case '--dest-prefix':
        options.destPrefix = args[++i]
        break
      case '--dry-run':
        options.dryRun = true
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
Letter Migration Script

Usage: node migrate-letters.js [options]

Options:
  --source-bucket <name>  Source S3 bucket (required)
  --source-prefix <path>  Source prefix (default: letters/)
  --dest-bucket <name>    Destination S3 bucket (required)
  --dest-prefix <path>    Destination prefix (default: letters/)
  --dry-run               Don't modify files, just report what would happen
  --verbose, -v           Show progress output
  --output, -o <file>     Write report to JSON file
  --help, -h              Show this help
`)
        process.exit(0)
    }
  }

  return options
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArgs(process.argv.slice(2))

  if (!options.sourceBucket || !options.destBucket) {
    console.error('Error: --source-bucket and --dest-bucket are required')
    process.exit(1)
  }

  runMigration(options)
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
      console.error('Migration failed:', error)
      process.exit(1)
    })
}
