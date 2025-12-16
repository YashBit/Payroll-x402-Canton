#!/bin/bash

echo "🔐 Getting OAuth2 token..."
TOKEN=$(curl -s -X POST http://localhost:8082/realms/AppUser/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=app-user-validator" \
  -d "client_secret=6m12QyyGl81d9nABWQXMycZdXho6ejEX" \
  -d "grant_type=client_credentials" \
  -d "audience=https://canton.network.global" | jq -r '.access_token')

echo "✅ Token obtained"

PARTY_ID="AcmePayroll::1220d19c5817f45ed90da1c93a7f6d5a20538458aeca7b15dfb9a7d9b30fb435a5b7"

echo ""
echo "👤 Creating Employee contract..."
echo "Party: $PARTY_ID"
echo "Employee ID: EMP001"
echo "Salary: 1000.0"

# We'll use the QuickTest script
echo "$TOKEN" > /tmp/canton-token.txt

daml script \
  --dar .daml/dist/payroll-poc-1.0.0.dar \
  --script-name QuickTest:quickTest \
  --ledger-host localhost \
  --ledger-port 2901 \
  --access-token-file /tmp/canton-token.txt

rm /tmp/canton-token.txt

echo ""
echo "✅ Script executed - check your bridge logs!"
