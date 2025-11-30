# Hold That Thought Documentation

Documentation hub for the Hold That Thought family letter sharing platform.

## Structure

```
docs/
├── developer/           # Developer documentation
│   ├── api-reference.md   # API endpoint documentation
│   ├── architecture.md    # System architecture
│   ├── deployment.md      # Deployment guides
│   └── troubleshooting.md # Common issues and solutions
├── user-guide/          # End user documentation
│   ├── README.md          # User guide overview
│   ├── comments.md        # Using comments
│   ├── messages.md        # Private messaging
│   ├── profiles.md        # Profile management
│   └── privacy.md         # Privacy settings
└── plans/               # Implementation plans
```

## Quick Links

### For Developers

- [Architecture Overview](developer/architecture.md)
- [API Reference](developer/api-reference.md)
- [Deployment Guide](developer/deployment.md)
- [Troubleshooting](developer/troubleshooting.md)

### Setup Guides

- [Authentication Setup](AUTHENTICATION_SETUP.md)
- [Media Upload Setup](MEDIA_UPLOAD_SETUP.md)
- [Gallery Setup](GALLERY_SETUP.md)
- [Monitoring Guide](MONITORING_GUIDE.md)

### For Users

- [User Guide](user-guide/README.md)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│                   (SvelteKit + Urara)                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                     API Gateway                              │
│                  (AWS API Gateway)                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                   Lambda Functions                           │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐  │
│  │ comments-api│ messages-api│ profile-api │reactions-api│  │
│  └─────────────┴─────────────┴─────────────┴─────────────┘  │
│  ┌─────────────────────────┬─────────────────────────────┐  │
│  │  activity-aggregator    │  notification-processor     │  │
│  └─────────────────────────┴─────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                        Storage                               │
│  ┌─────────────────────┐  ┌─────────────────────────────┐   │
│  │      DynamoDB       │  │          S3                 │   │
│  │  - UserProfiles     │  │  - Letters (PDFs)           │   │
│  │  - Comments         │  │  - Media uploads            │   │
│  │  - Messages         │  │  - Profile photos           │   │
│  │  - Reactions        │  │                             │   │
│  └─────────────────────┘  └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

- **Frontend**: SvelteKit + Urara (static blog framework)
- **Backend**: AWS Lambda (Node.js 20.x)
- **Database**: DynamoDB
- **Storage**: S3
- **Auth**: Amazon Cognito
- **IaC**: AWS SAM
- **Testing**: Vitest

## Development

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build
```

## Deployment

See [Deployment Guide](developer/deployment.md) for full instructions.

```bash
# Deploy backend with SAM
cd backend && sam build && sam deploy

# Deploy frontend
pnpm build && netlify deploy --prod
```
