#!/bin/bash

# Sophon Contract Verification Script
# No API key required!

echo "🚀 Sophon Contract Verification (Simple)"
echo "======================================="

# API endpoint
API_URL="https://api-explorer.sophon.xyz/api"

# Contract details
MOCK_USDC="0x3a364f43893C86553574bf28Bcb4a3d7ff0C7c1f"
MUSIC_STORE_IMPL="0x46dF1b6AAFC71cf6Cb231b57B4A51996DDb11Bb6"
MUSIC_STORE_PROXY="0x86E1D788FFCd8232D85dD7eB02c508e7021EB474"

# First, let's test if the API works
echo -e "\n📝 Testing API..."
curl -s "${API_URL}/stats/tokensupply?contractaddress=0x0000000000000000000000000000000000000000" | head -n 1

# Flatten MockUSDC
echo -e "\n\n📋 Verifying MockUSDC at ${MOCK_USDC}..."
echo "   Flattening contract..."
SOURCE_CODE=$(forge flatten src/MockUSDC.sol 2>/dev/null)

# Create JSON payload
JSON_PAYLOAD=$(cat <<EOF
{
  "address": "${MOCK_USDC}",
  "sourceCode": $(echo "$SOURCE_CODE" | jq -Rs .),
  "contractName": "MockUSDC",
  "compilerVersion": "v0.8.24+commit.e11b9ed9",
  "optimizationUsed": 1,
  "runs": 200,
  "evmVersion": "cancun"
}
EOF
)

# Send verification request
echo "   Sending verification request..."
RESPONSE=$(curl -s -X POST "${API_URL}/contract/verifysourcecode" \
  -H "Content-Type: application/json" \
  -d "$JSON_PAYLOAD")

echo "   Response: $RESPONSE"

# Extract GUID if successful
GUID=$(echo "$RESPONSE" | jq -r '.result // .message // empty')
if [ -n "$GUID" ]; then
  echo "   GUID: $GUID"
  
  # Check status
  echo -n "   Checking status"
  for i in {1..20}; do
    sleep 2
    STATUS=$(curl -s "${API_URL}/contract/checkverifystatus?guid=${GUID}")
    echo -n "."
    
    # Check if verified
    if echo "$STATUS" | grep -q '"status":"1"'; then
      echo -e "\n   ✅ Contract verified!"
      break
    elif echo "$STATUS" | grep -qv "Pending"; then
      echo -e "\n   Status: $STATUS"
      break
    fi
  done
fi

echo -e "\n\n📍 View contracts at: https://explorer.testnet.sophon.xyz"