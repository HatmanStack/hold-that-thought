# Letter Upload & Parsing Feature

## Overview
This feature enables the digitization and ingestion of physical letters into the Hold That Thought archive. It provides a workflow for users to upload scanned letters (as PDFs or multiple images), uses Google's Gemini AI to extract metadata and content, and offers a review interface to verify the data before publishing it to the permanent archive.

## Prerequisites
*   AWS CLI and SAM CLI installed
*   Node.js 20+
*   Google Gemini API Key
*   Properly configured `.env` files (managed via deployment scripts)

## Phase Summary

| Phase | Goal | Est. Tokens |
| :--- | :--- | :--- |
| **0** | **Architecture & Foundation**<br>System design, tech stack choices, deployment script enhancements, and testing strategy. | ~5k |
| **1** | **Backend Pipeline**<br>Infrastructure for uploads, asynchronous processing Lambda with Gemini integration, and Draft management APIs. | ~60k |
| **2** | **Frontend Experience**<br>Upload UI, Draft dashboard, and the Review/Publish workflow interface. | ~50k |

## Links
*   [Phase 0: Foundation](./Phase-0.md)
*   [Phase 1: Backend Implementation](./Phase-1.md)
*   [Phase 2: Frontend Implementation](./Phase-2.md)

---
**Commit Message Standards**
Do NOT include Co-Authored-By, Generated-By, or similar attribution lines in commit messages.