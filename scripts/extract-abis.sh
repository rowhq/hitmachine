#!/bin/bash

# Script to extract ABIs from compiled contracts to frontend

echo "📦 Extracting ABIs from compiled contracts..."

# Ensure jq is installed
if ! command -v jq &> /dev/null; then
    echo "❌ jq is required but not installed. Install it with: brew install jq"
    exit 1
fi

# Create ABI directory if it doesn't exist
mkdir -p frontend/app/abi

# Extract StoreV2 ABI
if [ -f "out/StoreV2.sol/StoreV2.json" ]; then
    cat out/StoreV2.sol/StoreV2.json | jq '.abi' > frontend/app/abi/storeV2.json
    echo "✅ Extracted StoreV2 ABI"
else
    echo "⚠️  StoreV2.json not found - run 'forge build' first"
fi

# Extract JobsV2 ABI
if [ -f "out/JobsV2.sol/JobsV2.json" ]; then
    cat out/JobsV2.sol/JobsV2.json | jq '.abi' > frontend/app/abi/jobsV2.json
    echo "✅ Extracted JobsV2 ABI"
else
    echo "⚠️  JobsV2.json not found - run 'forge build' first"
fi

# Extract MockUSDC ABI (for testnet)
if [ -f "out/MockUSDC.sol/MockUSDC.json" ]; then
    cat out/MockUSDC.sol/MockUSDC.json | jq '.abi' > frontend/app/abi/mockUsdc.json
    echo "✅ Extracted MockUSDC ABI"
else
    echo "⚠️  MockUSDC.json not found"
fi

echo "✨ ABI extraction complete!"