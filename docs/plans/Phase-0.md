# Phase 0: Foundation & Architecture

## Architecture Overview

The "Letter Upload" feature uses an **Asynchronous Draft-to-Publish** pattern.

1.  **Upload:** User uploads files (PDF or Images) to a temporary S3 location via Presigned URLs.
2.  **Trigger:** User initiates processing via an API call.
3.  **Process (Async):** A dedicated `LetterProcessor` Lambda:
    *   Fetches files from S3.
    *   Merges images into a single PDF (if applicable).
    *   Invokes **Google Gemini** to parse text, date, author, etc.
    *   Saves the result as a `DRAFT_LETTER` in DynamoDB.
4.  **Review:** User views the "Drafts" list in the UI.
5.  **Publish:** User reviews/edits the draft and "Publishes" it, converting the Draft to a permanent `LETTER` entity and moving the PDF to the permanent archive location.

### Architecture Decisions (ADR)

*   **ADR-001: Consolidated API for Control Plane:** We will continue using the `backend/lambdas/api` "Consolidated API" pattern for the Upload Request, Draft Management, and Publish endpoints. This reduces cold starts and simplifies the API Gateway configuration.
*   **ADR-002: Dedicated Lambda for Processing:** A new, separate Lambda (`LetterProcessorFunction`) will be used for the heavy lifting (PDF manipulation, Gemini calls). This isolates heavy dependencies (`pdf-lib`, `@google/generative-ai`) and long-running tasks from the responsive API tier.
*   **ADR-003: Gemini 1.5 Flash:** We will use `gemini-1.5-flash` for cost-effective and fast document understanding.
*   **ADR-004: Frontend Orchestration:** The frontend will handle uploading individual files to S3 directly (using presigned URLs) and then notify the backend to start processing. This avoids passing large binary payloads through API Gateway.

## Tech Stack

*   **Backend Runtime:** Node.js 20.x (Update from 18/24 if needed, keeping consistent with project).
*   **PDF Manipulation:** `pdf-lib` (Pure JS, lightweight, Lambda-friendly).
*   **AI Model:** Google Gemini (`@google/generative-ai` SDK).
*   **Infrastructure:** AWS SAM (Serverless Application Model).

## Deployment Strategy (`npm run deploy`)

We must update the existing `backend/scripts/deploy.sh` (or create a wrapper) to support the new Gemini API Key requirement.

**Script Logic:**
1.  **Input Collection:**
    *   Check for a local `.deploy-config.json` file.
    *   If missing or incomplete, prompt the user for:
        *   `StackName`
        *   `Region`
        *   `GeminiApiKey` (NEW)
    *   Save these values to `.deploy-config.json` (git-ignored).
2.  **Config Generation:**
    *   Read `.deploy-config.json`.
    *   Generate `samconfig.toml` programmatically.
    *   **Crucial:** Pass `GeminiApiKey` as a parameter override to SAM.
3.  **Deployment:**
    *   Run `sam deploy --config-file samconfig.toml`.
4.  **Post-Deploy:**
    *   Fetch Stack Outputs (API URL, etc.).
    *   Update/Create `frontend/.env` and `backend/.env` with these values for local development.

## Testing Strategy

*   **Unit Tests (Vitest):**
    *   **Lambda Logic:** Test the `LetterProcessor` logic by mocking `s3Client`, `dynamoDocClient`, and the `Gemini` instance.
    *   **API Routes:** Test new `drafts.js` routes using the existing controller test pattern.
*   **Integration Tests:**
    *   Use `local-dynamo` or mocked AWS SDK calls to verify the flow from "Draft Creation" to "Publishing" without actually hitting Gemini or S3 in CI.
*   **CI Enforcement:**
    *   All new code must pass `npm run check:test` (Lint + Unit + Integration).

## Data Model

### DynamoDB Entities

**Existing:**
*   `PK`: `LETTER#{date}`
*   `SK`: `METADATA` (or similar)

**New:**
*   `PK`: `DRAFT#{draftId}`
*   `SK`: `METADATA`
*   `entityType`: `DRAFT_LETTER`
*   `status`: `PROCESSING` | `REVIEW` | `ERROR`
*   `s3Key`: `temp/{uploadId}/combined.pdf` (Location of the source file)
*   `parsedData`: JSON object returned by Gemini (Author, Date, Body, etc.)

---
**Note:** This plan assumes we are working in the existing `backend/` and `frontend/` directory structure.
