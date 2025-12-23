#!/usr/bin/env bash

# Documentation Audit Script
# Compares documentation claims against actual codebase

DOCS_DIR="docs"
BACKEND_DIR="backend/lambdas/api"

echo "=== DOCUMENTATION AUDIT ==="
echo ""

# --- Summary counts ---
echo "## SUMMARY"
echo ""
doc_endpoints=$(grep -cP '### (GET|POST|PUT|DELETE) /' "$DOCS_DIR/API_REFERENCE.md" 2>/dev/null || echo 0)
code_handlers=$(grep -rhc "case 'GET':\|case 'POST':\|case 'PUT':\|case 'DELETE':" "$BACKEND_DIR/routes/" 2>/dev/null | awk '{s+=$1} END {print s}')
echo "Documented endpoints: $doc_endpoints"
echo "Code route handlers: $code_handlers"
echo ""

# --- VAGUE LANGUAGE ---
echo "## VAGUE LANGUAGE CHECK"
echo ""
patterns="easy|simple|just|powerful|awesome|please|we suggest|coming soon|in the future|you might"
matches=$(grep -rinE "$patterns" "$DOCS_DIR/"*.md 2>/dev/null | wc -l)
if [ "$matches" -gt 0 ]; then
    echo "Found $matches instances of vague language:"
    grep -rinE "$patterns" "$DOCS_DIR/"*.md 2>/dev/null | head -10
else
    echo "None found"
fi
echo ""

# --- DEAD FILE REFERENCES ---
echo "## DEAD FILE REFERENCES"
echo ""
dead_count=0
while IFS= read -r ref; do
    normalized=$(echo "$ref" | sed 's|^\./||')
    if [ ! -f "$normalized" ] && [ ! -f "$BACKEND_DIR/$normalized" ] && [ ! -f "frontend/$normalized" ]; then
        echo "DEAD: $ref"
        ((dead_count++)) || true
    fi
done < <(grep -rhoP '\./[a-zA-Z0-9/_.-]+\.(js|ts|svelte)' "$DOCS_DIR/" 2>/dev/null | sort -u)

if [ "$dead_count" -eq 0 ]; then
    echo "None found"
fi
echo ""

# --- UNDOCUMENTED EXPORTS ---
echo "## UNDOCUMENTED LIB EXPORTS"
echo ""
undoc_count=0
while IFS= read -r fn; do
    if ! grep -q "$fn" "$DOCS_DIR/"*.md 2>/dev/null; then
        echo "UNDOCUMENTED: $fn"
        ((undoc_count++)) || true
    fi
done < <(grep -rhoP "^exports\.\w+" "$BACKEND_DIR/lib/" 2>/dev/null | sed 's/exports\.//' | sort -u)

if [ "$undoc_count" -eq 0 ]; then
    echo "All exports documented"
fi
echo ""

echo "=== AUDIT COMPLETE ==="
