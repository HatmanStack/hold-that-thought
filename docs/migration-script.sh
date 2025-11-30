#!/bin/bash
# Hold That Thought - Monorepo Migration Script
# This script documents the commands used to restructure the repository.
# It is provided for documentation purposes and should not be re-run.

set -e

echo "=== Phase 1: Directory Structure Migration ==="
echo "Completed in previous phase - see docs/plans/Phase-1.md"

echo "=== Phase 2: Code Cleanup & Lambda Ports ==="

echo "Task 1: Port activity-aggregator to Node.js"
# Created: backend/lambdas/activity-aggregator/index.js
# Created: backend/lambdas/activity-aggregator/package.json
# Created: backend/lambdas/activity-aggregator/index.test.js
# Deleted: backend/lambdas/activity-aggregator/index.py
# Deleted: backend/lambdas/activity-aggregator/requirements.txt
# Deleted: backend/lambdas/activity-aggregator/test_handler.py

echo "Task 2: Port notification-processor to Node.js"
# Created: backend/lambdas/notification-processor/index.js
# Created: backend/lambdas/notification-processor/package.json
# Created: backend/lambdas/notification-processor/index.test.js
# Deleted: backend/lambdas/notification-processor/index.py
# Deleted: backend/lambdas/notification-processor/requirements.txt
# Deleted: backend/lambdas/notification-processor/test_handler.py

echo "Task 3: Update SAM Template"
# Modified: backend/template.yaml
# - Added ActivityAggregatorFunction
# - Added NotificationProcessorFunction
# - All functions use nodejs20.x runtime

echo "Task 4: Migrate Tests from Jest to Vitest"
# Tests were already Vitest-compatible
# Verified with: pnpm test

echo "Task 5-7: Strip Comments and console.log"
# Modified: backend/lambdas/*/index.js
# - Removed JSDoc comments
# - Removed inline comments
# - Kept console.error for CloudWatch logging

echo "Task 8: Update Deployment Scripts"
# Modified: backend/scripts/deploy-lambdas.sh
# - Removed Python packaging section
# - Added activity-aggregator and notification-processor to Node.js loop
# Modified: backend/scripts/deploy-production.sh
# - Added activity-aggregator to FUNCTIONS array

echo "Task 9: Consolidate Documentation"
# Created: docs/README.md (documentation index)

echo "=== Verification Commands ==="

echo "Verify no Python files in Lambda directories:"
echo "  find backend/lambdas -name '*.py' -type f"

echo "Verify SAM template is valid:"
echo "  cd backend && sam validate"

echo "Verify all tests pass:"
echo "  pnpm test"

echo "Verify frontend builds:"
echo "  pnpm build"

echo "=== Migration Complete ==="
echo "All Lambda functions are now Node.js"
echo "Tests use Vitest"
echo "Documentation consolidated in docs/"
