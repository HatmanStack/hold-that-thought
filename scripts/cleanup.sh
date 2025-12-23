#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORT_ONLY=false
EXECUTE=false
BACKUP_DIR="$PROJECT_ROOT/.cleanup-backup-$(date +%Y%m%d_%H%M%S)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

usage() {
    cat <<EOF
Usage: $0 [OPTIONS]

Options:
    --report-only   Show what would be changed (dry run)
    --execute       Apply all changes
    -h, --help      Show this help

Examples:
    $0 --report-only    # Dry run
    $0 --execute        # Apply changes
EOF
    exit 0
}

while [[ $# -gt 0 ]]; do
    case $1 in
        --report-only) REPORT_ONLY=true; shift ;;
        --execute) EXECUTE=true; shift ;;
        -h|--help) usage ;;
        *) log_error "Unknown option: $1"; exit 1 ;;
    esac
done

if [[ "$REPORT_ONLY" == "false" && "$EXECUTE" == "false" ]]; then
    log_error "Must specify --report-only or --execute"
    usage
fi

cd "$PROJECT_ROOT"

run_knip_audit() {
    log_info "Running AST-aware dead code analysis (knip)..."
    npx knip --exclude unresolved 2>/dev/null || true
}

count_console_statements() {
    log_info "Counting console statements..."
    local count
    count=$(grep -rE 'console\.(log|debug|info)' \
        --include="*.ts" --include="*.js" --include="*.svelte" \
        --exclude-dir=node_modules \
        --exclude-dir=.svelte-kit \
        --exclude-dir=tests \
        --exclude-dir=.aws-sam \
        "$PROJECT_ROOT" 2>/dev/null | wc -l || echo "0")
    echo "Found $count console.log/debug/info statements"
}

count_comments() {
    log_info "Counting comment lines..."
    local inline block
    inline=$(grep -rE '^\s*//' \
        --include="*.ts" --include="*.js" \
        --exclude-dir=node_modules \
        --exclude-dir=.svelte-kit \
        "$PROJECT_ROOT" 2>/dev/null | wc -l || echo "0")
    block=$(grep -rE '/\*\*?' \
        --include="*.ts" --include="*.js" \
        --exclude-dir=node_modules \
        --exclude-dir=.svelte-kit \
        "$PROJECT_ROOT" 2>/dev/null | wc -l || echo "0")
    echo "Found $inline inline comments, $block block comments"
}

detect_secrets() {
    log_info "Scanning for high-entropy strings (potential secrets)..."
    grep -rE '["\047][A-Za-z0-9+/=]{40,}["\047]' \
        --include="*.ts" --include="*.js" \
        --exclude-dir=node_modules \
        --exclude-dir=.svelte-kit \
        --exclude-dir=tests \
        "$PROJECT_ROOT" 2>/dev/null | grep -v "\.env" | head -20 || echo "No high-entropy secrets found"
}

remove_console_statements() {
    log_info "Removing console.log/debug/info statements..."
    find "$PROJECT_ROOT" -type f \( -name "*.ts" -o -name "*.js" -o -name "*.svelte" \) \
        -not -path "*/node_modules/*" \
        -not -path "*/.svelte-kit/*" \
        -not -path "*/tests/*" \
        -not -path "*/.aws-sam/*" \
        -not -path "*/backend/lambdas/api/lib/logger.js" \
        -exec sed -i '/^\s*console\.\(log\|debug\|info\)(/d' {} \;
    log_info "Console statements removed"
}

remove_inline_comments() {
    log_warn "Skipping inline comment removal - can corrupt code"
}

remove_jsdoc_comments() {
    log_warn "Skipping JSDoc removal - can corrupt code"
}

remove_empty_lines() {
    log_info "Removing consecutive empty lines..."
    find "$PROJECT_ROOT" -type f \( -name "*.ts" -o -name "*.js" \) \
        -not -path "*/node_modules/*" \
        -not -path "*/.svelte-kit/*" \
        -not -path "*/tests/*" \
        -print0 | while IFS= read -r -d '' file; do
        sed -i '/^$/N;/^\n$/d' "$file" 2>/dev/null || true
    done
    log_info "Empty lines cleaned"
}

remove_unused_deps() {
    log_info "Removing unused dependencies from frontend/package.json..."
    cd "$PROJECT_ROOT/frontend"
    npm uninstall @aws-sdk/client-lambda @aws-sdk/client-s3 gray-matter 2>/dev/null || true
    npm uninstall -D @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb @aws-sdk/s3-request-presigner \
        @importantimport/eslint-config @sveltejs/adapter-netlify @sveltejs/adapter-vercel \
        @types/unist remark svelte-preprocess sveltekit-embed tslib 2>/dev/null || true
    cd "$PROJECT_ROOT"
    log_info "Unused dependencies removed"
}

add_missing_deps() {
    log_info "Adding missing dependencies..."
    cd "$PROJECT_ROOT/backend/lambdas/api"
    npm install -D aws-lambda @types/aws-lambda 2>/dev/null || true
    npm install @aws-sdk/client-lambda 2>/dev/null || true
    cd "$PROJECT_ROOT/frontend"
    npm install -D unist-util-visit 2>/dev/null || true
    cd "$PROJECT_ROOT"
    log_info "Missing dependencies added"
}

delete_utils_barrel() {
    log_warn "Skipping utils.js deletion - required for backwards compatibility"
}

update_utils_imports() {
    log_info "Skipping import updates - utils.js barrel is retained"
}

create_backup() {
    log_info "Creating backup at $BACKUP_DIR..."
    mkdir -p "$BACKUP_DIR"
    cp -r "$PROJECT_ROOT/frontend/package.json" "$BACKUP_DIR/frontend-package.json"
    cp -r "$PROJECT_ROOT/backend/lambdas/api" "$BACKUP_DIR/api-backup"
    log_info "Backup created"
}

if [[ "$REPORT_ONLY" == "true" ]]; then
    echo ""
    echo "=========================================="
    echo "       CLEANUP REPORT (DRY RUN)          "
    echo "=========================================="
    echo ""
    run_knip_audit
    echo ""
    count_console_statements
    count_comments
    echo ""
    detect_secrets
    echo ""
    echo "Run with --execute to apply changes"
    exit 0
fi

if [[ "$EXECUTE" == "true" ]]; then
    echo ""
    echo "=========================================="
    echo "       EXECUTING CLEANUP                 "
    echo "=========================================="
    echo ""

    create_backup

    log_info "Phase 1: Remove console statements"
    remove_console_statements

    log_info "Phase 2: Remove comments"
    remove_inline_comments
    remove_jsdoc_comments
    remove_empty_lines

    log_info "Phase 3: Update dependencies"
    remove_unused_deps
    add_missing_deps

    log_info "Phase 4: Remove dead code"
    update_utils_imports
    delete_utils_barrel

    log_info "Phase 5: Run lint fix"
    cd "$PROJECT_ROOT/frontend"
    npm run lint:fix 2>/dev/null || true

    cd "$PROJECT_ROOT"
    log_info "Cleanup complete. Backup at: $BACKUP_DIR"
    log_info "Run 'npm run lint' to verify"
fi
