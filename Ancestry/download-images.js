#!/usr/bin/env node
/**
 * Download images from Ancestry exports
 *
 * Usage:
 *   node download-images.js <parsed-dir> <output-dir> [cookies-file]
 *
 * The cookies file should contain your Ancestry session cookies in Netscape format
 * or as a JSON array from a browser extension export.
 *
 * Example cookies.json format:
 * [
 *   { "name": "authentication", "value": "...", "domain": ".ancestry.com" },
 *   ...
 * ]
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const EXPORT_DIR = process.argv[2] || './ancestry_export';
const OUTPUT_DIR = process.argv[3] || './images';
const COOKIES_FILE = process.argv[4] || './cookies.json';

// Delay between downloads (ms)
const DELAY = 1000;

function loadCookies(cookiesFile) {
  if (!fs.existsSync(cookiesFile)) {
    console.warn(`Warning: No cookies file found at ${cookiesFile}`);
    console.warn('Images may fail to download without authentication.');
    return '';
  }

  try {
    const data = JSON.parse(fs.readFileSync(cookiesFile, 'utf-8'));

    // Handle array of cookie objects
    if (Array.isArray(data)) {
      return data
        .filter(c => c.domain && c.domain.includes('ancestry'))
        .map(c => `${c.name}=${c.value}`)
        .join('; ');
    }

    // Handle object with cookies property
    if (data.cookies) {
      return data.cookies
        .filter(c => c.domain && c.domain.includes('ancestry'))
        .map(c => `${c.name}=${c.value}`)
        .join('; ');
    }

    return '';
  } catch (e) {
    console.warn(`Warning: Could not parse cookies file: ${e.message}`);
    return '';
  }
}

function downloadImage(url, outputPath, cookies) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/*,*/*',
        'Referer': 'https://www.ancestry.com/',
      }
    };

    if (cookies) {
      options.headers['Cookie'] = cookies;
    }

    const req = https.request(options, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        // Follow redirect
        const redirectUrl = res.headers.location;
        if (redirectUrl) {
          downloadImage(redirectUrl.startsWith('http') ? redirectUrl : `https://${urlObj.hostname}${redirectUrl}`, outputPath, cookies)
            .then(resolve)
            .catch(reject);
          return;
        }
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        fs.writeFileSync(outputPath, buffer);
        resolve(buffer.length);
      });
      res.on('error', reject);
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  if (!fs.existsSync(EXPORT_DIR)) {
    console.error(`Export directory not found: ${EXPORT_DIR}`);
    process.exit(1);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const cookies = loadCookies(COOKIES_FILE);
  if (cookies) {
    console.log('Loaded authentication cookies');
  }

  const files = fs.readdirSync(EXPORT_DIR).filter(f => f.endsWith('.json'));
  console.log(`Found ${files.length} parsed person files`);

  let downloaded = 0;
  let failed = 0;
  let skipped = 0;

  for (const file of files) {
    const personId = path.basename(file, '.json');
    const data = JSON.parse(fs.readFileSync(path.join(EXPORT_DIR, file), 'utf-8'));

    // Collect all image URLs
    const images = [];

    // Primary image
    if (data.primaryImage?.url) {
      images.push({
        url: data.primaryImage.url,
        filename: `${personId}_primary.jpg`
      });
    }

    // Media gallery images
    if (data.media?.length > 0) {
      data.media.forEach((m, i) => {
        const url = m.downloadUrl || m.thumbnailUrl;
        if (url) {
          images.push({
            url: url.startsWith('http') ? url : `https://www.ancestry.com${url}`,
            filename: `${personId}_${m.id || i}.${m.ext || 'jpg'}`
          });
        }
      });
    }

    if (images.length === 0) {
      continue;
    }

    console.log(`\n${data.name?.full || personId}: ${images.length} image(s)`);

    for (const img of images) {
      const outPath = path.join(OUTPUT_DIR, img.filename);

      // Skip if already downloaded
      if (fs.existsSync(outPath)) {
        console.log(`  Skip: ${img.filename} (exists)`);
        skipped++;
        continue;
      }

      try {
        const size = await downloadImage(img.url, outPath, cookies);
        console.log(`  OK: ${img.filename} (${Math.round(size / 1024)}KB)`);
        downloaded++;
        await sleep(DELAY);
      } catch (e) {
        console.log(`  FAIL: ${img.filename} - ${e.message}`);
        failed++;
      }
    }
  }

  console.log(`\nDone! Downloaded: ${downloaded}, Skipped: ${skipped}, Failed: ${failed}`);
  console.log(`Output: ${OUTPUT_DIR}/`);
}

main().catch(console.error);
