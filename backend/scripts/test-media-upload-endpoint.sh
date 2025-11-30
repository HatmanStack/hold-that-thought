#!/bin/bash
# Test Media Upload Lambda endpoint
API_URL="$1"
JWT_TOKEN="$2"
FILE_PATH="$3"

if [ -z "$API_URL" ] || [ -z "$JWT_TOKEN" ] || [ -z "$FILE_PATH" ]; then
  echo "Usage: $0 <api_url> <jwt_token> <file_path>"
  exit 1
fi

curl -X POST "$API_URL/upload" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Accept: application/json" \
  -F "file=@$FILE_PATH" \
  -v
