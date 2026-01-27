#!/bin/bash
set -e

cd "$(dirname "$0")/.."

ENV_DEPLOY_FILE=".env.deploy"
FRONTEND_ENV="../.env"

echo "==================================="
echo "Hold That Thought - Backend Deployment"
echo "==================================="
echo ""

# Check for command line flags
FORCE_MIGRATE=false
FORCE_POPULATE=false
for arg in "$@"; do
    case $arg in
        --force-migrate)
            FORCE_MIGRATE=true
            shift
            ;; 
        --force-populate)
            FORCE_POPULATE=true
            shift
            ;; 
        --dry-run)
            DRY_RUN=true
            shift
            ;; 
    esac
done

# Warning if running sam deploy directly would cause issues
if [ -f "$FRONTEND_ENV" ] && [ -f "$ENV_DEPLOY_FILE" ]; then
    FRONTEND_API=$(grep "^PUBLIC_API_GATEWAY_URL=" "$FRONTEND_ENV" 2>/dev/null | cut -d'=' -f2)
    SAVED_STACK=$(grep "^STACK_NAME=" "$ENV_DEPLOY_FILE" 2>/dev/null | cut -d'=' -f2)

    if [ -n "$FRONTEND_API" ] && [ -n "$SAVED_STACK" ]; then
        echo "NOTE: Frontend .env points to API: $FRONTEND_API"
        echo "      Saved stack name: $SAVED_STACK"
        echo ""
        echo "IMPORTANT: Always use this script (./scripts/deploy.sh) instead of"
        echo "           running 'sam deploy' directly to keep configurations in sync."
        echo ""
    fi
fi

# Load from .env.deploy if it exists
if [ -f "$ENV_DEPLOY_FILE" ]; then
    echo "Loading configuration from $ENV_DEPLOY_FILE..."
    export $(grep -v '^#' "$ENV_DEPLOY_FILE" | grep -v '^$' | xargs)
fi

# Get region with default
DEFAULT_REGION="${AWS_REGION:-us-east-1}"
read -p "AWS Region [$DEFAULT_REGION]: " input_region
AWS_REGION="${input_region:-$DEFAULT_REGION}"

# Get stack name with default
DEFAULT_STACK="${STACK_NAME:-hold-that-thought}"
read -p "Stack Name [$DEFAULT_STACK]: " input_stack
STACK_NAME="${input_stack:-$DEFAULT_STACK}"

# Get app domain with default
DEFAULT_APP_DOMAIN="${APP_DOMAIN:-localhost:5173}"
read -p "App Domain (for OAuth callbacks) [$DEFAULT_APP_DOMAIN]: " input_domain
APP_DOMAIN="${input_domain:-$DEFAULT_APP_DOMAIN}"

# Allowed Origins with default
DEFAULT_ORIGINS="${ALLOWED_ORIGINS:-*}"
read -p "Allowed Origins (CORS) [$DEFAULT_ORIGINS]: " input_origins
ALLOWED_ORIGINS="${input_origins:-$DEFAULT_ORIGINS}"

# Google OAuth setup
echo ""
echo "--- Google OAuth Setup ---"
echo "To enable Google Sign-In, you need a Google OAuth Client ID."
echo "Create one at: https://console.cloud.google.com/apis/credentials"
echo "Leave empty to skip Google OAuth."
echo ""

if [ -n "$GOOGLE_CLIENT_ID" ]; then
    echo "Google Client ID: [${GOOGLE_CLIENT_ID:0:20}... - press Enter to keep, or paste new]"
else
    echo "Google Client ID: [not set]"
fi
read -p "> " input_google_id
if [ -n "$input_google_id" ]; then
    GOOGLE_CLIENT_ID="$input_google_id"
fi

if [ -n "$GOOGLE_CLIENT_ID" ]; then
    if [ -n "$GOOGLE_CLIENT_SECRET" ]; then
        echo "Google Client Secret: [hidden - press Enter to keep, or paste new]"
    else
        echo "Google Client Secret: [not set]"
    fi
    read -p "> " input_google_secret
    if [ -n "$input_google_secret" ]; then
        GOOGLE_CLIENT_SECRET="$input_google_secret"
    fi
fi

# Google Gemini Setup
echo ""
echo "--- Google Gemini Setup (NEW) ---"
echo "To enable Letter Processing, you need a Google Gemini API Key."
echo "Get one at: https://aistudio.google.com/app/apikey"
echo ""

if [ -n "$GEMINI_API_KEY" ]; then
    echo "Gemini API Key: [hidden - press Enter to keep, or paste new]"
else
    echo "Gemini API Key: [not set]"
fi
read -p "> " input_gemini_key
if [ -n "$input_gemini_key" ]; then
    GEMINI_API_KEY="$input_gemini_key"
fi

echo ""
echo "--- DynamoDB (Single Table Design) ---"

DEFAULT_TABLE="${TABLE_NAME:-HoldThatThought}"
read -p "DynamoDB Table Name [$DEFAULT_TABLE]: " input_table
TABLE_NAME="${input_table:-$DEFAULT_TABLE}"

echo ""
echo "--- Email Notifications (SES) ---"
echo "Enter the email address to send notifications from."
echo "The domain must be verified in SES."
echo ""

DEFAULT_SES_FROM="${SES_FROM_EMAIL:-}"
read -p "From Email [$DEFAULT_SES_FROM]: " input_ses_from
SES_FROM_EMAIL="${input_ses_from:-$DEFAULT_SES_FROM}"

echo ""
echo "Enter the admin email for contact form submissions."
echo ""

DEFAULT_ADMIN="${ADMIN_EMAIL:-}"
read -p "Admin Email [$DEFAULT_ADMIN]: " input_admin
ADMIN_EMAIL="${input_admin:-$DEFAULT_ADMIN}"

echo ""
echo "--- S3 Archive Bucket ---"
echo "Single bucket for letters, media, and deployment artifacts."
echo ""

DEFAULT_ARCHIVE="${ARCHIVE_BUCKET:-hold-that-thought-archive}"
read -p "Archive Bucket [$DEFAULT_ARCHIVE]: " input_bucket
ARCHIVE_BUCKET="${input_bucket:-$DEFAULT_ARCHIVE}"

echo ""
echo "--- RAGStack Configuration ---"
echo "RAGStack provides AI-powered search, chat, and media storage."
echo ""
echo "You have two options:"
echo "  1. NEW DEPLOYMENT (recommended for first-time users):"
echo "     Press Enter to leave this blank. A fresh RAGStack instance"
echo "     will be deployed automatically as part of this stack."
echo "     You will be prompted for an admin email for the RAGStack"
echo "     dashboard and alerts."
echo ""
echo "  2. EXISTING RAGSTACK:"
echo "     If you already deployed RAGStack separately (e.g. from the"
echo "     AWS Marketplace or via RAGStack-Lambda), enter that stack"
echo "     name here. This stack will reference the existing RAGStack"
echo "     resources instead of creating new ones."
echo "     You can find your stack name in the CloudFormation console."
echo ""

DEFAULT_RAGSTACK_STACK="${RAGSTACK_STACK_NAME:-}"
read -p "Existing RAGStack Stack Name (leave empty for new) [$DEFAULT_RAGSTACK_STACK]: " input_ragstack_stack
RAGSTACK_STACK_NAME="${input_ragstack_stack:-$DEFAULT_RAGSTACK_STACK}"

if [ -z "$RAGSTACK_STACK_NAME" ]; then
    echo ""
    echo "  -> Will deploy a new RAGStack nested stack."
    echo "     This adds AI search, chat, and media indexing to your app."
    echo ""
    DEFAULT_RAGSTACK_EMAIL="${RAGSTACK_ADMIN_EMAIL:-$ADMIN_EMAIL}"
    read -p "RAGStack Admin Email [$DEFAULT_RAGSTACK_EMAIL]: " input_ragstack_email
    RAGSTACK_ADMIN_EMAIL="${input_ragstack_email:-$DEFAULT_RAGSTACK_EMAIL}"
else
    echo ""
    echo "  -> Will reference existing stack: $RAGSTACK_STACK_NAME"
    echo "     Fetching RAGStack outputs from CloudFormation exports..."
    echo ""

    # Fetch existing RAGStack values (may be in a different region, e.g. us-east-1)
    RAGSTACK_EXPORT_REGION="${RAGSTACK_REGION:-us-east-1}"
    echo "     Looking up exports from region: $RAGSTACK_EXPORT_REGION"

    RAGSTACK_DATA_BUCKET=$(aws cloudformation list-exports --region "$RAGSTACK_EXPORT_REGION" \
        --query "Exports[?Name=='${RAGSTACK_STACK_NAME}-DataBucket'].Value" --output text 2>/dev/null)
    RAGSTACK_GRAPHQL_URL=$(aws cloudformation list-exports --region "$RAGSTACK_EXPORT_REGION" \
        --query "Exports[?Name=='${RAGSTACK_STACK_NAME}-GraphQLApiUrl'].Value" --output text 2>/dev/null)
    RAGSTACK_API_KEY=$(aws cloudformation list-exports --region "$RAGSTACK_EXPORT_REGION" \
        --query "Exports[?Name=='${RAGSTACK_STACK_NAME}-GraphQLApiKey'].Value" --output text 2>/dev/null)
    RAGSTACK_CHAT_URL=$(aws cloudformation list-exports --region "$RAGSTACK_EXPORT_REGION" \
        --query "Exports[?Name=='${RAGSTACK_STACK_NAME}-WebComponentCDNUrl'].Value" --output text 2>/dev/null)

    if [ -z "$RAGSTACK_DATA_BUCKET" ] || [ "$RAGSTACK_DATA_BUCKET" = "None" ]; then
        echo "ERROR: Could not find exports for stack '$RAGSTACK_STACK_NAME' in $RAGSTACK_EXPORT_REGION"
        echo "Make sure the stack name is correct and the stack is deployed."
        exit 1
    fi

    echo "     Data Bucket:  $RAGSTACK_DATA_BUCKET"
    echo "     GraphQL URL:  $RAGSTACK_GRAPHQL_URL"
    echo "     API Key:      ${RAGSTACK_API_KEY:0:8}..."
    echo "     Chat Widget:  $RAGSTACK_CHAT_URL"
    RAGSTACK_ADMIN_EMAIL=""
fi

# Letters archive check
echo ""
echo "--- Letter Archive ---"
echo "Letters are stored in s3://$ARCHIVE_BUCKET/letters/"
echo "DynamoDB will be populated from this archive on first deploy."

# Save configuration
cat > "$ENV_DEPLOY_FILE" << EOF
# Deployment configuration (auto-saved)
AWS_REGION=$AWS_REGION
STACK_NAME=$STACK_NAME
APP_DOMAIN=$APP_DOMAIN
ALLOWED_ORIGINS=$ALLOWED_ORIGINS
GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET
GEMINI_API_KEY=$GEMINI_API_KEY
TABLE_NAME=$TABLE_NAME
SES_FROM_EMAIL=$SES_FROM_EMAIL
ADMIN_EMAIL=$ADMIN_EMAIL
ARCHIVE_BUCKET=$ARCHIVE_BUCKET
RAGSTACK_STACK_NAME=$RAGSTACK_STACK_NAME
RAGSTACK_ADMIN_EMAIL=$RAGSTACK_ADMIN_EMAIL
LETTERS_DB_POPULATED=$LETTERS_DB_POPULATED
EOF
echo ""
echo "Configuration saved to $ENV_DEPLOY_FILE"

# Generate samconfig.toml so `sam deploy` without arguments uses correct config
DEPLOY_BUCKET="sam-deploy-hold-that-thought-${AWS_REGION}"
PARAM_OVERRIDES_TOML="AllowedOrigins=$ALLOWED_ORIGINS AppDomain=$APP_DOMAIN TableName=$TABLE_NAME SesFromEmail=$SES_FROM_EMAIL AdminEmail=$ADMIN_EMAIL ArchiveBucket=$ARCHIVE_BUCKET GeminiApiKey=$GEMINI_API_KEY RagStackStackName=$RAGSTACK_STACK_NAME"
if [ -n "$RAGSTACK_ADMIN_EMAIL" ]; then
    PARAM_OVERRIDES_TOML="$PARAM_OVERRIDES_TOML RagStackAdminEmail=$RAGSTACK_ADMIN_EMAIL"
fi
if [ -n "$GOOGLE_CLIENT_ID" ]; then
    PARAM_OVERRIDES_TOML="$PARAM_OVERRIDES_TOML GoogleClientId=$GOOGLE_CLIENT_ID GoogleClientSecret=$GOOGLE_CLIENT_SECRET"
fi

cat > "samconfig.toml" << EOF
# SAM CLI configuration file (auto-generated from .env.deploy)
# This ensures 'sam deploy' uses the same config as ./scripts/deploy.sh
# Re-run ./scripts/deploy.sh to regenerate this file

version = 0.1

[default.deploy.parameters]
stack_name = "$STACK_NAME"
s3_bucket = "$DEPLOY_BUCKET"
s3_prefix = "$STACK_NAME"
region = "$AWS_REGION"
capabilities = "CAPABILITY_IAM CAPABILITY_AUTO_EXPAND"
confirm_changeset = false
fail_on_empty_changeset = false
parameter_overrides = "$PARAM_OVERRIDES_TOML"
EOF
echo "Updated samconfig.toml"

echo ""
echo "Using configuration:"
echo "  Region: $AWS_REGION"
echo "  Stack Name: $STACK_NAME"
echo "  App Domain: $APP_DOMAIN"
echo "  Allowed Origins: $ALLOWED_ORIGINS"
echo "  Archive Bucket: $ARCHIVE_BUCKET"
if [ -n "$GOOGLE_CLIENT_ID" ]; then
    echo "  Google OAuth: Enabled"
else
    echo "  Google OAuth: Disabled"
fi
if [ -n "$GEMINI_API_KEY" ]; then
    echo "  Gemini API: Configured"
else
    echo "  Gemini API: Not configured (Letter Processing will fail)"
fi
echo ""

# Dry run mode - stop here
if [ "$DRY_RUN" = "true" ]; then
    echo "==================================="
    echo "DRY RUN - Configuration validated"
    echo "==================================="
    exit 0
fi

# Create deployment bucket if needed
DEPLOY_BUCKET="sam-deploy-hold-that-thought-${AWS_REGION}"
echo "==================================="
echo "Step 1: Setup Buckets"
echo "==================================="

# Deployment bucket
if ! aws s3 ls "s3://${DEPLOY_BUCKET}" --region "$AWS_REGION" 2>/dev/null; then
    echo "Creating deployment bucket: ${DEPLOY_BUCKET}"
    aws s3 mb "s3://${DEPLOY_BUCKET}" --region "$AWS_REGION"
else
    echo "Deployment bucket exists: ${DEPLOY_BUCKET}"
fi

# Archive bucket (replaces media and profile photos buckets)
if ! aws s3 ls "s3://${ARCHIVE_BUCKET}" --region "$AWS_REGION" 2>/dev/null; then
    echo "Creating archive bucket: ${ARCHIVE_BUCKET}"
    aws s3 mb "s3://${ARCHIVE_BUCKET}" --region "$AWS_REGION"
    aws s3api put-bucket-cors --bucket "$ARCHIVE_BUCKET" --region "$AWS_REGION" --cors-configuration '{ 
      "CORSRules": [{
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
        "AllowedOrigins": ["*"],
        "ExposeHeaders": ["ETag"],
        "MaxAgeSeconds": 3000
      }]
    }'
    echo "  CORS configured for archive bucket"
else
    echo "Archive bucket exists: ${ARCHIVE_BUCKET}"
fi

# Pre-flight: Check for orphaned resources that would cause CloudFormation to fail
echo ""
echo "==================================="
echo "Step 2: Pre-flight Resource Check"
echo "==================================="

# Check if DynamoDB table exists outside CloudFormation
EXISTING_TABLE=$(aws dynamodb describe-table --table-name "$TABLE_NAME" --region "$AWS_REGION" 2>/dev/null || true)
if [ -n "$EXISTING_TABLE" ]; then
    # Check if it's managed by our stack
    STACK_EXISTS=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$AWS_REGION" 2>/dev/null || true)
    if [ -z "$STACK_EXISTS" ]; then
        echo "WARNING: DynamoDB table '$TABLE_NAME' exists but is not managed by stack '$STACK_NAME'"
        ITEM_COUNT=$(aws dynamodb scan --table-name "$TABLE_NAME" --region "$AWS_REGION" --select COUNT --query 'Count' --output text 2>/dev/null || echo "0")

        if [ "$ITEM_COUNT" = "0" ]; then
            echo "  Table is empty. Deleting to allow CloudFormation to create it..."
            aws dynamodb delete-table --table-name "$TABLE_NAME" --region "$AWS_REGION" >/dev/null 2>&1
            echo "  Waiting for table deletion..."
            aws dynamodb wait table-not-exists --table-name "$TABLE_NAME" --region "$AWS_REGION" 2>/dev/null || sleep 10
            echo "  Table deleted."
        else
            echo "  Table contains $ITEM_COUNT items."
            echo ""
            echo "ERROR: Cannot proceed - table has data but isn't managed by CloudFormation."
            echo "Options:"
            echo "  1. Use a different TABLE_NAME in deployment config"
            echo "  2. Manually delete the table if data is not needed"
            echo "  3. Import the table into CloudFormation (advanced)"
            exit 1
        fi
    fi
fi
echo "Pre-flight checks passed."

# Check letter archive exists
echo ""
echo "==================================="
echo "Step 3: Verify Letter Archive"
echo "==================================="

LETTER_COUNT=$(aws s3 ls "s3://$ARCHIVE_BUCKET/letters/" --recursive 2>/dev/null | grep -E "\.json$" | wc -l || echo "0")
echo "Found $LETTER_COUNT letters in archive (s3://$ARCHIVE_BUCKET/letters/)"

if [ "$LETTER_COUNT" = "0" ]; then
    echo "WARNING: No letters found in archive bucket."
    echo "Letters should be stored in s3://$ARCHIVE_BUCKET/letters/{date}/{date}.json"
fi

echo ""
echo "==================================="
echo "Step 3: Build SAM Application"
echo "==================================="
echo ""
sam build --template template.yaml

echo ""
echo "==================================="
echo "Step 4: Deploy Stack"
echo "==================================="
echo ""

# Build parameter overrides
PARAM_OVERRIDES="AllowedOrigins=$ALLOWED_ORIGINS"
PARAM_OVERRIDES="$PARAM_OVERRIDES AppDomain=$APP_DOMAIN"
PARAM_OVERRIDES="$PARAM_OVERRIDES TableName=$TABLE_NAME"
PARAM_OVERRIDES="$PARAM_OVERRIDES SesFromEmail=$SES_FROM_EMAIL"
PARAM_OVERRIDES="$PARAM_OVERRIDES AdminEmail=$ADMIN_EMAIL"
PARAM_OVERRIDES="$PARAM_OVERRIDES ArchiveBucket=$ARCHIVE_BUCKET"
PARAM_OVERRIDES="$PARAM_OVERRIDES GeminiApiKey=$GEMINI_API_KEY"
PARAM_OVERRIDES="$PARAM_OVERRIDES RagStackStackName=$RAGSTACK_STACK_NAME"
PARAM_OVERRIDES="$PARAM_OVERRIDES RagStackAdminEmail=$RAGSTACK_ADMIN_EMAIL"

if [ -n "$RAGSTACK_STACK_NAME" ]; then
    PARAM_OVERRIDES="$PARAM_OVERRIDES RagStackDataBucketName=$RAGSTACK_DATA_BUCKET"
    PARAM_OVERRIDES="$PARAM_OVERRIDES RagStackGraphQLApiUrl=$RAGSTACK_GRAPHQL_URL"
    PARAM_OVERRIDES="$PARAM_OVERRIDES RagStackGraphQLApiKey=$RAGSTACK_API_KEY"
    PARAM_OVERRIDES="$PARAM_OVERRIDES RagStackChatWidgetUrl=$RAGSTACK_CHAT_URL"
fi

if [ -n "$GOOGLE_CLIENT_ID" ]; then
    PARAM_OVERRIDES="$PARAM_OVERRIDES GoogleClientId=$GOOGLE_CLIENT_ID"
    PARAM_OVERRIDES="$PARAM_OVERRIDES GoogleClientSecret=$GOOGLE_CLIENT_SECRET"
fi

sam deploy \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --s3-bucket "$DEPLOY_BUCKET" \
    --s3-prefix "$STACK_NAME" \
    --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
    --parameter-overrides $PARAM_OVERRIDES \
    --no-confirm-changeset \
    --no-fail-on-empty-changeset

# Populate DynamoDB with letter data (after stack is deployed so table exists)
echo ""
echo "==================================="
echo "Step 5: DynamoDB Letter Population"
echo "==================================="

if [ "$LETTERS_DB_POPULATED" != "true" ] || [ "$FORCE_POPULATE" = "true" ]; then
    if [ "$LETTER_COUNT" != "0" ]; then
        echo "Populating DynamoDB from letter archive..."
        echo "  Source: s3://$ARCHIVE_BUCKET/letters/"
        echo "  Table: $TABLE_NAME"

        if node scripts/populate-from-archive.js \
            --bucket "$ARCHIVE_BUCKET" \
            --prefix "letters/" \
            --table "$TABLE_NAME" \
            --verbose; then

            echo "DynamoDB population complete!"

            # Mark as populated
            sed -i "s/^LETTERS_DB_POPULATED=.*/LETTERS_DB_POPULATED=true/" "$ENV_DEPLOY_FILE"
            if ! grep -q "^LETTERS_DB_POPULATED=" "$ENV_DEPLOY_FILE"; then
                echo "LETTERS_DB_POPULATED=true" >> "$ENV_DEPLOY_FILE"
            fi
        else
            echo "WARNING: DynamoDB population failed!"
            echo "You can re-run with --force-populate to try again."
        fi
    else
        echo "No letters in archive. Skipping DynamoDB population."
    fi
else
    echo "DynamoDB already populated. Skipping."
    echo "Use --force-populate to re-run population."
fi

echo ""
echo "==================================="
echo "Deployment Complete!"
echo "==================================="
echo ""

# Get stack outputs
API_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
    --output text 2>/dev/null || echo "")

USER_POOL_ID=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
    --output text 2>/dev/null || echo "")

USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
    --output text 2>/dev/null || echo "")

IDENTITY_POOL_ID=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`IdentityPoolId`].OutputValue' \
    --output text 2>/dev/null || echo "")

COGNITO_HOSTED_UI_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`CognitoHostedUIUrl`].OutputValue' \
    --output text 2>/dev/null || echo "")

COGNITO_HOSTED_UI_DOMAIN=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`CognitoHostedUIDomain`].OutputValue' \
    --output text 2>/dev/null || echo "")

RAGSTACK_GRAPHQL_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`RagStackGraphQLUrl`].OutputValue' \
    --output text 2>/dev/null || echo "")

RAGSTACK_API_KEY=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`RagStackApiKey`].OutputValue' \
    --output text 2>/dev/null || echo "")

RAGSTACK_CHAT_WIDGET_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`RagStackChatWidgetUrl`].OutputValue' \
    --output text 2>/dev/null || echo "")

echo "Stack Outputs:"
echo "  API URL: $API_URL"
echo "  User Pool ID: $USER_POOL_ID"
echo "  User Pool Client ID: $USER_POOL_CLIENT_ID"
echo "  Identity Pool ID: $IDENTITY_POOL_ID"
echo "  Cognito Hosted UI: $COGNITO_HOSTED_UI_URL"
echo "  RAGStack GraphQL: $RAGSTACK_GRAPHQL_URL"
echo "  RAGStack Chat Widget: $RAGSTACK_CHAT_WIDGET_URL"
echo ""

# Update frontend .env file (root for backwards compat, frontend/ for Vite)
FRONTEND_ENV="../.env"
FRONTEND_DIR_ENV="../frontend/.env"

update_env_var() {
    local key=$1
    local value=$2
    local file=$3

    if [ -z "$value" ] || [ "$value" = "None" ]; then
        return
    fi

    if grep -q "^${key}=" "$file" 2>/dev/null; then
        sed -i "s|^${key}=.*|${key}=${value}|" "$file"
    else
        echo "${key}=${value}" >> "$file"
    fi
}

# Preserve custom variables from existing .env files before updating
PRESERVED_RAGSTACK_CHAT_URL=""
PRESERVED_RAGSTACK_GRAPHQL_URL=""
PRESERVED_RAGSTACK_API_KEY=""
PRESERVED_GUEST_EMAIL=""
PRESERVED_GUEST_PASSWORD=""

# Check frontend/.env first, then root .env for existing values
for env_file in "$FRONTEND_DIR_ENV" "$FRONTEND_ENV"; do
    if [ -f "$env_file" ]; then
        [ -z "$PRESERVED_RAGSTACK_CHAT_URL" ] && PRESERVED_RAGSTACK_CHAT_URL=$(grep "^PUBLIC_RAGSTACK_CHAT_URL=" "$env_file" 2>/dev/null | cut -d'=' -f2-)
        [ -z "$PRESERVED_RAGSTACK_GRAPHQL_URL" ] && PRESERVED_RAGSTACK_GRAPHQL_URL=$(grep "^PUBLIC_RAGSTACK_GRAPHQL_URL=" "$env_file" 2>/dev/null | cut -d'=' -f2-)
        [ -z "$PRESERVED_RAGSTACK_API_KEY" ] && PRESERVED_RAGSTACK_API_KEY=$(grep "^PUBLIC_RAGSTACK_API_KEY=" "$env_file" 2>/dev/null | cut -d'=' -f2-)
        [ -z "$PRESERVED_GUEST_EMAIL" ] && PRESERVED_GUEST_EMAIL=$(grep "^PUBLIC_GUEST_EMAIL=" "$env_file" 2>/dev/null | cut -d'=' -f2-)
        [ -z "$PRESERVED_GUEST_PASSWORD" ] && PRESERVED_GUEST_PASSWORD=$(grep "^PUBLIC_GUEST_PASSWORD=" "$env_file" 2>/dev/null | cut -d'=' -f2-)
    fi
done

# Create .env if it doesn't exist
if [ ! -f "$FRONTEND_ENV" ]; then
    cat > "$FRONTEND_ENV" << EOF
# AWS Configuration
PUBLIC_AWS_REGION=$AWS_REGION

# Cognito Configuration
PUBLIC_COGNITO_USER_POOL_ID=$USER_POOL_ID
PUBLIC_COGNITO_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
PUBLIC_COGNITO_IDENTITY_POOL_ID=$IDENTITY_POOL_ID
PUBLIC_COGNITO_HOSTED_UI_URL=$COGNITO_HOSTED_UI_URL
PUBLIC_COGNITO_HOSTED_UI_DOMAIN=$COGNITO_HOSTED_UI_DOMAIN

# API Gateway URL
PUBLIC_API_GATEWAY_URL=$API_URL

# Archive Bucket
PUBLIC_ARCHIVE_BUCKET=$ARCHIVE_BUCKET

# RAGStack Integration (from nested stack)
PUBLIC_RAGSTACK_CHAT_URL=${RAGSTACK_CHAT_WIDGET_URL:-$PRESERVED_RAGSTACK_CHAT_URL}
PUBLIC_RAGSTACK_GRAPHQL_URL=${RAGSTACK_GRAPHQL_URL:-$PRESERVED_RAGSTACK_GRAPHQL_URL}
PUBLIC_RAGSTACK_API_KEY=${RAGSTACK_API_KEY:-$PRESERVED_RAGSTACK_API_KEY}

# Guest Login (optional - set values to enable one-click guest access)
PUBLIC_GUEST_EMAIL=$PRESERVED_GUEST_EMAIL
PUBLIC_GUEST_PASSWORD=$PRESERVED_GUEST_PASSWORD
EOF
    echo "Created frontend .env file"
else
    update_env_var "PUBLIC_AWS_REGION" "$AWS_REGION" "$FRONTEND_ENV"
    update_env_var "PUBLIC_API_GATEWAY_URL" "$API_URL" "$FRONTEND_ENV"
    update_env_var "PUBLIC_COGNITO_USER_POOL_ID" "$USER_POOL_ID" "$FRONTEND_ENV"
    update_env_var "PUBLIC_COGNITO_USER_POOL_CLIENT_ID" "$USER_POOL_CLIENT_ID" "$FRONTEND_ENV"
    update_env_var "PUBLIC_COGNITO_IDENTITY_POOL_ID" "$IDENTITY_POOL_ID" "$FRONTEND_ENV"
    update_env_var "PUBLIC_COGNITO_HOSTED_UI_URL" "$COGNITO_HOSTED_UI_URL" "$FRONTEND_ENV"
    update_env_var "PUBLIC_COGNITO_HOSTED_UI_DOMAIN" "$COGNITO_HOSTED_UI_DOMAIN" "$FRONTEND_ENV"
    update_env_var "PUBLIC_ARCHIVE_BUCKET" "$ARCHIVE_BUCKET" "$FRONTEND_ENV"
    # RAGStack values from nested stack outputs (fall back to preserved values)
    update_env_var "PUBLIC_RAGSTACK_CHAT_URL" "${RAGSTACK_CHAT_WIDGET_URL:-$PRESERVED_RAGSTACK_CHAT_URL}" "$FRONTEND_ENV"
    update_env_var "PUBLIC_RAGSTACK_GRAPHQL_URL" "${RAGSTACK_GRAPHQL_URL:-$PRESERVED_RAGSTACK_GRAPHQL_URL}" "$FRONTEND_ENV"
    update_env_var "PUBLIC_RAGSTACK_API_KEY" "${RAGSTACK_API_KEY:-$PRESERVED_RAGSTACK_API_KEY}" "$FRONTEND_ENV"
    [ -n "$PRESERVED_GUEST_EMAIL" ] && update_env_var "PUBLIC_GUEST_EMAIL" "$PRESERVED_GUEST_EMAIL" "$FRONTEND_ENV"
    [ -n "$PRESERVED_GUEST_PASSWORD" ] && update_env_var "PUBLIC_GUEST_PASSWORD" "$PRESERVED_GUEST_PASSWORD" "$FRONTEND_ENV"
    echo "Updated frontend .env file (preserved custom vars)"
fi

# Sync .env to frontend/ directory for Vite, preserving custom vars
if [ -f "$FRONTEND_DIR_ENV" ]; then
    # Preserve any custom vars from frontend/.env that aren't in root .env
    while IFS= read -r line; do
        # Skip empty lines and comments
        [[ -z "$line" || "$line" =~ ^# ]] && continue
        key=$(echo "$line" | cut -d'=' -f1)
        # If this key doesn't exist in root .env, add it
        if ! grep -q "^${key}=" "$FRONTEND_ENV" 2>/dev/null; then
            echo "$line" >> "$FRONTEND_ENV"
        fi
    done < "$FRONTEND_DIR_ENV"
fi
cp "$FRONTEND_ENV" "$FRONTEND_DIR_ENV"
echo "Synced .env to frontend/ for Vite (preserving custom vars)"

echo ""
echo "==================================="
echo "Step 6: Guest User Setup"
echo "==================================="

# Check if guest credentials are configured in .env
GUEST_EMAIL=$(grep "^PUBLIC_GUEST_EMAIL=" "$FRONTEND_ENV" 2>/dev/null | cut -d'=' -f2)
GUEST_PASSWORD=$(grep "^PUBLIC_GUEST_PASSWORD=" "$FRONTEND_ENV" 2>/dev/null | cut -d'=' -f2)

if [ -n "$GUEST_EMAIL" ] && [ -n "$GUEST_PASSWORD" ]; then
    echo "Recreating guest user from .env credentials..."
    echo "  Email: $GUEST_EMAIL"
    CREATE_OUTPUT=$(node scripts/create-guest-user.js "$GUEST_EMAIL" "$GUEST_PASSWORD" 2>&1)
    CREATE_STATUS=$?
    if [ $CREATE_STATUS -eq 0 ]; then
        echo "  Guest user ready!"
    elif echo "$CREATE_OUTPUT" | grep -qi "already exists"; then
        echo "  Guest user already exists."
    else
        echo "  WARNING: Guest user creation failed:"
        echo "$CREATE_OUTPUT" | grep -v "Password" | head -5
    fi
else
    echo "No guest credentials configured in .env"
    echo "To enable guest login, add to your .env:"
    echo "  PUBLIC_GUEST_EMAIL=guest@showcase.demo"
    echo "  PUBLIC_GUEST_PASSWORD=GuestDemo@123"
    echo "Then run: cd backend/scripts && node create-guest-user.js"
fi

echo ""
echo "==================================="
echo "Deployment Complete!"
echo "==================================="
echo ""
echo "Frontend .env has been updated with stack outputs."
echo "  Root: .env"
echo "  Vite: frontend/.env"