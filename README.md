<h1 align="center">Hold That Thought</h1>

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
<b>Sharing letters, one typo at a time<br><a href="https://float-app.fun/">Hold That Thought »</a></b>
</p>

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
npm run dev      # Start frontend dev server
npm run build    # Build frontend for production
npm run deploy   # Deploy backend (SAM)
npm test         # Run unit tests
npm run lint     # ESLint + type check
npm run check    # Run all checks (lint + tests)
```

## Deployment

```bash
npm run deploy   # Backend (Lambda + API Gateway + DynamoDB)
npm run build    # Frontend build
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for full setup and configuration.

## License

Apache License 2.0
