# Family Relationships Feature - Implementation Plan

## Feature Overview

This feature adds a "My Family Relationships" section to user profiles, allowing users to define their relationships to people mentioned in the family archive. Users can specify relationships like "Grandmother (maternal): Mary Smith" so that when they use the chat feature, the system understands context like "What did my grandmother write about?"

The relationships are stored as part of the user profile and injected into the LLM context during chat sessions. This enables personalized queries without requiring the user to repeatedly specify who their relatives are. A soft limit of 10 relationships triggers a warning about potential impact on chat quality, though users can add more if needed.

The implementation follows existing patterns in the codebase: extending the profile types, updating the profile settings UI with a new section, and modifying the backend to store/retrieve the relationship data.

## Prerequisites

- Node.js v24 LTS (via nvm)
- AWS CLI configured with appropriate credentials
- SAM CLI installed
- Access to the existing `hold-test` CloudFormation stack
- Familiarity with Svelte 4, DaisyUI, and DynamoDB single-table design

## Important Notes

- **DO NOT** include Co-Authored-By, Generated-By, or similar attribution lines in commit messages
- All commits should follow the conventional commits format
- Tests must pass in CI environment (no live AWS resources)

## Phase Summary

| Phase | Goal | Token Estimate |
|-------|------|----------------|
| 0 | Foundation - Architecture decisions, patterns, testing strategy | ~5,000 |
| 1 | Full Implementation - Types, UI, Backend, Tests | ~50,000 |

**Note:** This is a relatively small feature that fits comfortably in a single implementation phase.

## Navigation

- [Phase 0: Foundation](./Phase-0.md) - Architecture decisions and patterns
- [Phase 1: Implementation](./Phase-1.md) - Complete feature implementation
