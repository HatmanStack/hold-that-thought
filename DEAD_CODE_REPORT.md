# Dead Code Audit Report

Generated: 2025-12-23

## Summary

| Category | Count | Action |
|----------|-------|--------|
| Unused dependencies | 3 | Remove from frontend/package.json |
| Unused devDependencies | 11 | Remove from frontend/package.json |
| Unlisted dependencies | 4 | Add to appropriate package.json |
| Unused exports | 1 | Delete or mark as intentional |

---

## Unused Dependencies (3)

These packages are listed in `frontend/package.json` but never imported:

| Package | Location | Action |
|---------|----------|--------|
| @aws-sdk/client-lambda | frontend/package.json:17 | DELETE |
| @aws-sdk/client-s3 | frontend/package.json:18 | DELETE |
| gray-matter | frontend/package.json:19 | DELETE |

---

## Unused Dev Dependencies (11)

| Package | Location | Action |
|---------|----------|--------|
| @aws-sdk/client-dynamodb | frontend/package.json:30 | DELETE |
| @aws-sdk/lib-dynamodb | frontend/package.json:31 | DELETE |
| @aws-sdk/s3-request-presigner | frontend/package.json:32 | DELETE |
| @importantimport/eslint-config | frontend/package.json:33 | DELETE |
| @sveltejs/adapter-netlify | frontend/package.json:35 | DELETE |
| @sveltejs/adapter-vercel | frontend/package.json:38 | DELETE |
| @types/unist | frontend/package.json:43 | DELETE |
| remark | frontend/package.json:60 | DELETE |
| svelte-preprocess | frontend/package.json:67 | DELETE |
| sveltekit-embed | frontend/package.json:68 | DELETE |
| tslib | frontend/package.json:70 | DELETE |

---

## Unlisted Dependencies (4)

These are used but not declared in package.json:

| Package | Location | Action |
|---------|----------|--------|
| aws-lambda | backend/lambdas/api/index.js:12 | ADD to backend/lambdas/api/package.json devDeps |
| aws-lambda | backend/lambdas/api/lib/responses.js:11 | (same as above) |
| @aws-sdk/client-lambda | backend/lambdas/api/routes/drafts.js:3 | ADD to backend/lambdas/api/package.json |
| unist-util-visit | frontend/mdsvex.config.js:12 | ADD to frontend/package.json devDeps |

---

## Unused Exports (1)

| Export | File | Action |
|--------|------|--------|
| default | backend/lambdas/api/utils.js:18 | DELETE (barrel export no longer needed) |

---

## Console Statements

Found ~279 console.log/debug/info statements across 58 files.

**High-density files (backend):**
- backend/lambdas/api/routes/messages.js (14)
- backend/lambdas/api/routes/comments.js (14)
- backend/lambdas/notification-processor/index.js (17)

**Action:** Remove all console.log/debug/info. Keep console.error/warn.

---

## Execution

Run `./scripts/cleanup.sh --report-only` for dry run.
Run `./scripts/cleanup.sh --execute` to apply changes.
