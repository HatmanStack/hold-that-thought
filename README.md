<img align="center" src="htt_banner.jpg" alt="Hold That Thought - Banner">

<p align="center">
<a href="https://github.com/HatmanStack/hold-that-thought/actions"><img src="https://github.com/HatmanStack/hold-that-thought/workflows/CI/badge.svg" alt="CI Status" /></a>
<a href="https://www.apache.org/licenses/LICENSE-2.0.html"><img src="https://img.shields.io/badge/license-Apache2.0-blue" alt="Apache 2.0 License" /></a>
</p>

<p align="center">
<a href="https://kit.svelte.dev"><img src="https://img.shields.io/badge/SvelteKit-2.x-orange" alt="SvelteKit" /></a>
<a href="https://vitest.dev"><img src="https://img.shields.io/badge/Vitest-2.x-yellow" alt="Vitest" /></a>
<a href="https://docs.aws.amazon.com/lambda/"><img src="https://img.shields.io/badge/AWS-Lambda-FF9900" alt="AWS Lambda" /></a>
<a href="https://aws.amazon.com/dynamodb/"><img src="https://img.shields.io/badge/AWS-DynamoDB-4053D6" alt="AWS DynamoDB" /></a>
<a href="https://aws.amazon.com/cognito/"><img src="https://img.shields.io/badge/AWS-Cognito-DD344C" alt="AWS Cognito" /></a>
<a href="https://aws.amazon.com/s3/"><img src="https://img.shields.io/badge/AWS-S3-569A31" alt="AWS S3" /></a>
</p>

<p align="center">
<b>Sharing letters, one typo at a time<br><a href="https://family.hatstack.fun/">Hold That Thought »</a></b>
</p>

A private family platform for sharing letters, photos, and memories. Upload scanned letters with AI-powered transcription and browse a shared media gallery. All media is embedded in a RAG backend for semantic search and connected to a chat client for conversational access to your family's content.

## Structure

```text
├── frontend/   # SvelteKit client (lib, routes, static)
├── backend/    # AWS Lambda serverless API (SAM)
├── docs/       # Documentation
└── tests/      # Centralized test suites (unit, e2e, load)
```

## Prerequisites

- **Node.js** v24 LTS (via nvm)
- **npm** (included with Node.js)
- **AWS CLI** configured with credentials
- **AWS SAM CLI** for serverless deployment

## Quick Start

```bash
npm install                    # Install root dependencies
cd frontend && npm install     # Install frontend dependencies
cd ..
cp .env.example .env           # Configure environment
npm run dev                    # Start dev server
```

## Scripts

```bash
npm run dev       # Start frontend dev server
npm run build     # Build frontend for production
npm run deploy    # Deploy backend (SAM)
npm test          # Run unit tests
npm run test:e2e  # Run Playwright E2E tests
npm run test:load # Run Artillery load tests
npm run lint      # ESLint + type check
npm run check     # Run all checks (lint + tests)
```

## RAGStack Integration

Optional AI-powered search and chat. Deploy [RAGStack-Lambda](https://github.com/HatmanStack/RAGStack-Lambda) and configure:

```bash
PUBLIC_RAGSTACK_CHAT_URL=https://<cloudfront>/ragstack-chat.js
PUBLIC_RAGSTACK_GRAPHQL_URL=https://<appsync-id>.appsync-api.<region>.amazonaws.com/graphql
PUBLIC_RAGSTACK_API_KEY=<appsync-api-key>
```

Features enabled:
- **Chat widget** on homepage (AI assistant for family content)
- **Semantic search** across indexed media
- **Auto-indexing** of gallery uploads to knowledge base

## Deployment

```bash
npm run deploy   # Backend (Lambda + API Gateway + DynamoDB)
npm run build    # Frontend build
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for full setup and configuration.

## License

Apache License 2.0
