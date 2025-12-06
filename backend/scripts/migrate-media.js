#!/usr/bin/env node
/**
 * Media Migration Script
 * Copies media files from old bucket to archive bucket preserving structure.
 */

import { listAllFiles, copyFile } from './lib/s3-operations.js'

/**
 * Run the media migration
 *
 * @param {Object} options - Migration options
 * @param {string} options.sourceBucket - Source bucket name
 * @param {string} options.sourcePrefix - Source prefix (default: 'media/')
 * @param {string} options.destBucket - Destination bucket name
 * @param {string} options.destPrefix - Destination prefix (default: 'media/')
 * @param {boolean} options.dryRun - If true, don't actually copy files
 * @param {boolean} options.verbose - If true, log progress
 * @returns {Promise<Object>} Migration report
 */
export async function runMediaMigration(options) {
  const {
    sourceBucket,
    sourcePrefix = 'media/',
    destBucket,
    destPrefix = 'media/',
    dryRun = false,
    verbose = false
  } = options

  if (verbose) {
    console.log(`Starting media migration from ${sourceBucket}/${sourcePrefix} to ${destBucket}/${destPrefix}`)
    if (dryRun) console.log('DRY RUN - no files will be copied')
  }

  // List all files to migrate
  const files = await listAllFiles(sourceBucket, sourcePrefix)
  if (verbose) {
    console.log(`Found ${files.length} files to migrate`)
  }

  const results = {
    total: files.length,
    successful: 0,
    failed: 0,
    skipped: 0,
    files: [],
    errors: []
  }

  for (const file of files) {
    // Skip directory markers
    if (file.key.endsWith('/')) {
      results.skipped++
      continue
    }

    // Calculate destination key (preserve structure relative to source prefix)
    const relativePath = file.key.slice(sourcePrefix.length)
    const destKey = `${destPrefix}${relativePath}`

    try {
      if (!dryRun) {
        await copyFile(sourceBucket, file.key, destBucket, destKey)
      }

      results.successful++
      results.files.push({
        source: file.key,
        dest: destKey,
        size: file.size
      })

      if (verbose) {
        console.log(`  ✓ ${file.key} -> ${destKey}`)
      }
    } catch (error) {
      results.failed++
      results.errors.push({
        source: file.key,
        error: error.message
      })

      if (verbose) {
        console.log(`  ✗ ${file.key}: ${error.message}`)
      }
    }
  }

  if (verbose) {
    console.log(`\nMedia migration complete:`)
    console.log(`  Total: ${results.total}`)
    console.log(`  Successful: ${results.successful}`)
    console.log(`  Failed: ${results.failed}`)
    console.log(`  Skipped (directories): ${results.skipped}`)
  }

  return results
}

/**
 * Parse command line arguments
 */
function parseArgs(args) {
  const options = {
    sourceBucket: null,
    sourcePrefix: 'media/',
    destBucket: null,
    destPrefix: 'media/',
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
Media Migration Script

Usage: node migrate-media.js [options]

Options:
  --source-bucket <name>  Source S3 bucket (required)
  --source-prefix <path>  Source prefix (default: media/)
  --dest-bucket <name>    Destination S3 bucket (required)
  --dest-prefix <path>    Destination prefix (default: media/)
  --dry-run               Don't copy files, just report what would happen
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

  runMediaMigration(options)
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
      console.error('Media migration failed:', error)
      process.exit(1)
    })
}
