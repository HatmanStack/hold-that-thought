# Implementation Plan: User Profiles, Comments & Messaging

## Feature Overview

This plan implements a comprehensive social layer for the "Hold That Thought" family letter-sharing application. The feature adds three interconnected capabilities: a commenting system for letters and media items, rich user profile pages with activity tracking, and a direct messaging system for family communication.

The implementation follows a serverless-first architecture using AWS DynamoDB for data persistence, Lambda functions for business logic, and API Gateway for HTTP endpoints. All features integrate with the existing Cognito authentication system and maintain the family-private nature of the application (ApprovedUsers only).

The design prioritizes simplicity and maintainability: flat comment structures (no threading), asynchronous messaging (no WebSockets), and email-based notifications. This approach keeps infrastructure costs low (~$15-30/month for 50 users) while delivering a robust social experience for family members sharing memories.

## Prerequisites

**Backend:**
- AWS CLI configured with appropriate credentials
- CloudFormation CLI (for infrastructure deployment)
- Node.js v22+ (for Lambda development)
- Python 3.13+ with uv (for stream processors)
- Access to existing AWS resources: S3 bucket, Cognito User Pool, API Gateway

**Frontend:**
- SvelteKit development environment
- pnpm package manager
- Familiarity with Svelte 4.x, TailwindCSS, DaisyUI

**Tools:**
- Git (conventional commits workflow)
- Code editor with TypeScript support
- Postman or curl (for API testing)

**Knowledge Requirements:**
- DynamoDB single-table design patterns
- AWS Lambda event-driven architecture
- SvelteKit SSR and routing
- REST API design
- JWT authentication flows

## Phase Summary

| Phase | Goal | Key Deliverables | Est. Tokens |
|-------|------|------------------|-------------|
| 0 | Foundation & Architecture | ADRs, schema design, patterns | N/A (reference) |
| 1 | Backend Foundation | DynamoDB tables, Lambda functions, API endpoints | ~95,000 |
| 2 | Comments System | UI components, letter integration, notifications | ~85,000 |
| 3 | User Profiles | Profile pages, activity tracking, privacy controls | ~80,000 |
| 4 | Messaging System | DM backend, conversation UI, attachments | ~90,000 |
| 5 | Polish & Launch | Testing, optimization, documentation, deployment | ~50,000 |
| **Total** | **Complete Feature** | **Production-ready social layer** | **~400,000** |

## Phase Navigation

- **[Phase 0: Foundation & Architecture](./Phase-0.md)** - Start here for design decisions and patterns
- **[Phase 1: Backend Foundation](./Phase-1.md)** - DynamoDB + Lambda infrastructure
- **[Phase 2: Comments System](./Phase-2.md)** - Comment UI and integration
- **[Phase 3: User Profiles](./Phase-3.md)** - Profile pages and activity tracking
- **[Phase 4: Messaging System](./Phase-4.md)** - Direct messaging implementation
- **[Phase 5: Polish & Launch](./Phase-5.md)** - Testing, optimization, deployment

## Implementation Strategy

**Sequential Phases:** Each phase builds on the previous. Do not skip ahead.

**Testing Approach:** Test-driven development with unit tests before integration tests.

**Deployment Model:** Infrastructure as Code (CloudFormation) with blue/green Lambda deployments.

**Rollback Safety:** Feature flags allow disabling incomplete features in production.

## Success Criteria

The implementation is complete when:

1. ✅ Family members can comment on any letter or media item
2. ✅ Comments support reactions (likes) and can be edited/deleted
3. ✅ User profiles display bio, family relationships, and activity stats
4. ✅ Comment history on profiles links back to original items
5. ✅ Direct messaging works for 1-on-1 and group conversations
6. ✅ Message attachments (photos, documents) upload successfully
7. ✅ Email notifications sent for comments, reactions, and DMs
8. ✅ Admin moderation tools allow comment deletion
9. ✅ Privacy controls hide private profiles from non-owners
10. ✅ All features work on mobile and desktop browsers

## Cost & Performance Targets

**Monthly Cost:** $15-30 for 50 active users (PAY_PER_REQUEST DynamoDB)

**Performance:**
- API response time: < 500ms (p95)
- Page load time: < 2s (p95)
- Comment submission: < 1s
- Email notification delivery: < 5 minutes

## Timeline Estimate

- Phase 1: 2 weeks (backend foundation)
- Phase 2: 1 week (comments UI)
- Phase 3: 1 week (profiles)
- Phase 4: 2 weeks (messaging)
- Phase 5: 1 week (polish)

**Total: ~7 weeks** for a single full-time developer

## Getting Started

1. Read **Phase 0** thoroughly to understand architecture decisions
2. Set up local development environment per prerequisites
3. Begin **Phase 1** - each task builds sequentially
4. Commit frequently using conventional commit format
5. Test each task before moving to the next

## Questions or Issues?

- Architecture questions: Review Phase 0 ADRs
- Implementation blockers: Check phase prerequisites
- Test failures: Review verification checklists
- Deployment issues: See Phase 5 deployment guide
