# Documentation Style Guide

## Prohibited Content

### Language
- "Please", "We suggest", "You might want to"
- "Easy", "Simple", "Just", "Powerful", "Awesome"
- "Coming soon", "In the future", "Planned"
- "For example" without an actual example
- Rhetorical questions
- First-person plural ("We", "Our", "Let's")

### Structure
- Introductions longer than one sentence
- Explanations of why something exists
- Historical context or "background"
- Comparisons to alternatives
- Theoretical use cases
- Disclaimers or caveats

### Formatting
- Emoji
- Exclamation marks
- Bold for emphasis (use for terms only)
- Inline links (use reference-style)
- Nested lists deeper than 2 levels

---

## Required Structure

### API Endpoint Documentation
```markdown
### METHOD /path/{param}
Description in imperative mood. One sentence max.

**Signature:** `METHOD /path/{param}?query=`
**Auth:** Required group or "Public"
**Rate Limit:** X/Ymin (if applicable)
**Dependencies:** Service names

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| param | type | Yes/No | What it is |

**Response:** status code
\`\`\`json
{ "field": "type" }
\`\`\`
```

### Function Documentation
```markdown
### functionName(params) -> ReturnType
**File:** path/to/file.ts:lineNumber
**Complexity:** O(n) or O(1)
**Dependencies:** imports used

| Parameter | Type | Description |
|-----------|------|-------------|
| param | type | What it is |

**Returns:** What it returns
**Throws:** Error conditions
```

### Configuration Documentation
```markdown
## VARIABLE_NAME
**Type:** string | number | boolean
**Required:** Yes | No
**Default:** value or "None"
**Example:** `VARIABLE_NAME=value`

What this controls. One sentence.
```

---

## Tone Rules

1. **Imperative mood**: "Set the value" not "You should set the value"
2. **Present tense**: "Returns the user" not "Will return the user"
3. **Active voice**: "The function validates" not "Validation is performed"
4. **Specific over general**: "10 requests per minute" not "rate limited"
5. **Code over prose**: Show the syntax, not describe it

---

## Validation Checklist

Before committing documentation:

- [ ] No prohibited language patterns
- [ ] Every claim has code reference or file path
- [ ] Every parameter has type and required status
- [ ] Every endpoint has response schema
- [ ] No orphaned references to non-existent code
- [ ] No TODO/FIXME/Coming Soon markers
- [ ] Matches current implementation (run drift check)

---

## Drift Prevention

Run before committing docs:
```bash
npm run dead-code  # Finds orphaned code
```

Manual checks:
1. Search docs for function names
2. Verify each exists in codebase with same signature
3. Remove any that don't match
