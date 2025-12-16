#!/bin/bash

echo "🔐 Getting OAuth2 token..."
TOKEN=$(curl -s -X POST http://localhost:8082/realms/AppUser/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=app-user-validator" \
  -d "client_secret=6m12QyyGl81d9nABWQXMycZdXho6ejEX" \
  -d "grant_type=client_credentials" \
  -d "audience=https://canton.network.global" | jq -r '.access_token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Failed to get OAuth2 token"
  exit 1
fi

echo "✅ Token obtained: ${TOKEN:0:50}..."

echo ""
echo "📤 Uploading DAR to Canton..."

# Create temp file with token
echo "$TOKEN" > /tmp/canton-token.txt

daml ledger upload-dar \
  --host localhost \
  --port 2901 \
  --access-token-file /tmp/canton-token.txt \
  .daml/dist/payroll-poc-1.0.0.dar

rm /tmp/canton-token.txt

echo "✅ Upload complete!"
