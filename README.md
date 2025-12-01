<h1 align="center">Hold That Thought</h1>

<h4 align="center">
<a href="https://www.apache.org/licenses/LICENSE-2.0.html"><img src="https://img.shields.io/badge/license-Apache2.0-blue" alt="Apache 2.0 License" /></a>
<a href="https://kit.svelte.dev"><img src="https://img.shields.io/badge/SvelteKit-2.x-orange" alt="SvelteKit" /></a>
<a href="https://docs.aws.amazon.com/lambda/"><img src="https://img.shields.io/badge/AWS-Lambda-green" alt="AWS Lambda" /></a>
<a href="https://aws.amazon.com/cognito/"><img src="https://img.shields.io/badge/AWS-Cognito-yellow" alt="AWS Cognito" /></a>
</h4>

<p align="center">
<b>Sharing letters, one typo at a time<br><a href="https://float-app.fun/">Hold That Thought »</a></b>
</p>

## Structure

```text
├── frontend/   # SvelteKit client
├── backend/    # AWS Lambda serverless API
├── docs/       # Documentation
└── tests/      # Centralized test suites
```

## Prerequisites

- **Node.js** v24 LTS (via nvm)
- **pnpm** v9.10+
- **AWS CLI** configured with credentials
- **AWS SAM CLI** for serverless deployment

## Quick Start

```bash
pnpm install          # Install dependencies
cp .env.example .env  # Configure environment
pnpm dev              # Start dev server
```

## Testing

```bash
pnpm test             # Run all tests (91 tests)
pnpm lint             # ESLint
pnpm check            # Svelte type check
```

## Deployment

```bash
# Backend
cd backend && sam build && sam deploy

# Frontend
pnpm build && netlify deploy --prod
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for full documentation.

## Features

- [x] Base Round Robin 1999-2016
- [x] Tags for Search
- [x] Comment on Letters
- [x] Edit Letters (OCR corrections)
- [x] Private Messaging
- [ ] Picture Gallery
- [ ] Family Documents

## License

Apache License 2.0
