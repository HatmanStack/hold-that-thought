#!/bin/bash
# Test PDF Download Lambda endpoint
API_URL="$1"
JWT_TOKEN="$2"
FILENAME="$3"

if [ -z "$API_URL" ] || [ -z "$JWT_TOKEN" ]; then
  echo "Usage: $0 <api_url> <jwt_token> [filename]"
  exit 1
fi

curl -X GET "$API_URL/pdf-download${FILENAME:+?filename=$FILENAME}" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Accept: application/json" \
  -v
