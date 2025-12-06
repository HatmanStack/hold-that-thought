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
DEFAULT_REGION="${AWS_REGION:-us-west-2}"
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

DEFAULT_SES_FROM="${SES_FROM_EMAIL:-noreply@holdthatthought.family}"
read -p "From Email [$DEFAULT_SES_FROM]: " input_ses_from
SES_FROM_EMAIL="${input_ses_from:-$DEFAULT_SES_FROM}"

echo ""
echo "--- S3 Archive Bucket ---"
echo "Single bucket for letters, media, and deployment artifacts."
echo ""

DEFAULT_ARCHIVE="${ARCHIVE_BUCKET:-hold-that-thought-archive}"
read -p "Archive Bucket [$DEFAULT_ARCHIVE]: " input_bucket
ARCHIVE_BUCKET="${input_bucket:-$DEFAULT_ARCHIVE}"

# Letters migration setup (only if not already migrated)
echo ""
echo "--- Letter Migration ---"
if [ "$LETTERS_MIGRATED" = "true" ] && [ "$FORCE_MIGRATE" != "true" ]; then
    echo "Letters have already been migrated."
    echo "Use --force-migrate to re-run migration."
else
    if [ -n "$LETTERS_SOURCE_URI" ]; then
        echo "Letters Source URI: [${LETTERS_SOURCE_URI} - press Enter to keep, or enter new]"
    else
        echo "Enter the S3 URI where existing letters are stored."
        echo "Example: s3://hold-that-thought-bucket/letters/"
        echo "Leave empty to skip letter migration."
    fi
    read -p "Letters Source URI: " input_letters_uri
    if [ -n "$input_letters_uri" ]; then
        LETTERS_SOURCE_URI="$input_letters_uri"
    fi
fi

# Save configuration
cat > "$ENV_DEPLOY_FILE" << EOF
# Deployment configuration (auto-saved)
AWS_REGION=$AWS_REGION
STACK_NAME=$STACK_NAME
APP_DOMAIN=$APP_DOMAIN
ALLOWED_ORIGINS=$ALLOWED_ORIGINS
GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET
TABLE_NAME=$TABLE_NAME
SES_FROM_EMAIL=$SES_FROM_EMAIL
ARCHIVE_BUCKET=$ARCHIVE_BUCKET
LETTERS_SOURCE_URI=$LETTERS_SOURCE_URI
LETTERS_MIGRATED=$LETTERS_MIGRATED
LETTERS_DB_POPULATED=$LETTERS_DB_POPULATED
EOF
echo ""
echo "Configuration saved to $ENV_DEPLOY_FILE"

# Generate samconfig.toml so `sam deploy` without arguments uses correct config
DEPLOY_BUCKET="sam-deploy-hold-that-thought-${AWS_REGION}"
PARAM_OVERRIDES_TOML="AllowedOrigins=$ALLOWED_ORIGINS AppDomain=$APP_DOMAIN TableName=$TABLE_NAME SesFromEmail=$SES_FROM_EMAIL ArchiveBucket=$ARCHIVE_BUCKET"
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
capabilities = "CAPABILITY_IAM"
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

# Run letter migration if source provided and not already migrated
echo ""
echo "==================================="
echo "Step 2: Letter Migration"
echo "==================================="

if [ "$LETTERS_MIGRATED" != "true" ] || [ "$FORCE_MIGRATE" = "true" ]; then
    if [ -n "$LETTERS_SOURCE_URI" ]; then
        # Parse S3 URI to extract bucket and prefix
        SOURCE_BUCKET=$(echo "$LETTERS_SOURCE_URI" | sed 's|s3://||' | cut -d'/' -f1)
        SOURCE_PREFIX=$(echo "$LETTERS_SOURCE_URI" | sed 's|s3://||' | cut -d'/' -f2-)

        echo "Running letter migration..."
        echo "  Source: $SOURCE_BUCKET/$SOURCE_PREFIX"
        echo "  Destination: $ARCHIVE_BUCKET/letters/"

        # Run migration script
        if node scripts/migrate-letters.js \
            --source-bucket "$SOURCE_BUCKET" \
            --source-prefix "$SOURCE_PREFIX" \
            --dest-bucket "$ARCHIVE_BUCKET" \
            --dest-prefix "letters/" \
            --verbose \
            --output "migration-report.json"; then

            echo "Letter migration complete!"
            echo "  Report saved to migration-report.json"

            # Mark as migrated
            sed -i "s/^LETTERS_MIGRATED=.*/LETTERS_MIGRATED=true/" "$ENV_DEPLOY_FILE"
            LETTERS_MIGRATED=true
        else
            echo "ERROR: Letter migration failed!"
            echo "Check migration-report.json for details."
            echo ""
            read -p "Continue with deployment anyway? [y/N] " continue_deploy
            if [ "$continue_deploy" != "y" ] && [ "$continue_deploy" != "Y" ]; then
                exit 1
            fi
        fi
    else
        echo "No letters source URI provided, skipping migration."
    fi
else
    echo "Letters already migrated. Skipping."
    echo "Use --force-migrate to re-run migration."
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
PARAM_OVERRIDES="$PARAM_OVERRIDES ArchiveBucket=$ARCHIVE_BUCKET"

if [ -n "$GOOGLE_CLIENT_ID" ]; then
    PARAM_OVERRIDES="$PARAM_OVERRIDES GoogleClientId=$GOOGLE_CLIENT_ID"
    PARAM_OVERRIDES="$PARAM_OVERRIDES GoogleClientSecret=$GOOGLE_CLIENT_SECRET"
fi

sam deploy \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --s3-bucket "$DEPLOY_BUCKET" \
    --s3-prefix "$STACK_NAME" \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides $PARAM_OVERRIDES \
    --no-confirm-changeset \
    --no-fail-on-empty-changeset

# Populate DynamoDB with letter data (after stack is deployed so table exists)
echo ""
echo "==================================="
echo "Step 5: DynamoDB Letter Population"
echo "==================================="

if [ "$LETTERS_DB_POPULATED" != "true" ] || [ "$FORCE_POPULATE" = "true" ]; then
    if [ "$LETTERS_MIGRATED" = "true" ]; then
        echo "Populating DynamoDB with letter data..."
        echo "  Source: s3://$ARCHIVE_BUCKET/letters/"
        echo "  Table: $TABLE_NAME"

        POPULATE_FLAGS="--verbose"
        if [ "$FORCE_POPULATE" = "true" ]; then
            POPULATE_FLAGS="$POPULATE_FLAGS --force-all"
        fi

        if node scripts/populate-letters-db.js \
            --bucket "$ARCHIVE_BUCKET" \
            --prefix "letters/" \
            --table "$TABLE_NAME" \
            --region "$AWS_REGION" \
            $POPULATE_FLAGS \
            --output "populate-report.json"; then

            echo "DynamoDB population complete!"
            echo "  Report saved to populate-report.json"

            # Mark as populated
            sed -i "s/^LETTERS_DB_POPULATED=.*/LETTERS_DB_POPULATED=true/" "$ENV_DEPLOY_FILE"
            if ! grep -q "^LETTERS_DB_POPULATED=" "$ENV_DEPLOY_FILE"; then
                echo "LETTERS_DB_POPULATED=true" >> "$ENV_DEPLOY_FILE"
            fi
        else
            echo "WARNING: DynamoDB population failed!"
            echo "Check populate-report.json for details."
            echo "You can re-run with --force-populate to try again."
        fi
    else
        echo "Letters not migrated to S3 yet. Skipping DynamoDB population."
        echo "Run migration first, then use --force-populate."
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

echo "Stack Outputs:"
echo "  API URL: $API_URL"
echo "  User Pool ID: $USER_POOL_ID"
echo "  User Pool Client ID: $USER_POOL_CLIENT_ID"
echo "  Identity Pool ID: $IDENTITY_POOL_ID"
echo "  Cognito Hosted UI: $COGNITO_HOSTED_UI_URL"
echo ""

# Update frontend .env file
FRONTEND_ENV="../.env"

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
    echo "Updated frontend .env file"
fi

echo ""
echo "Done! Frontend .env has been updated with stack outputs."
