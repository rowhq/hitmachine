#!/bin/bash

# Testnet proxy addresses from DEPLOYED_CONTRACTS.md
export MUSIC_STORE_PROXY=0x86E1D788FFCd8232D85dD7eB02c508e7021EB474
export ANIMAL_CARE_PROXY=0xAAfD6b707770BC9F60A773405dE194348B6C4392

echo "========================================="
echo "Upgrading Testnet Contracts"
echo "========================================="
echo "Music Store Proxy: $MUSIC_STORE_PROXY"
echo "Animal Care Proxy: $ANIMAL_CARE_PROXY"
echo "========================================="
echo ""

# Load environment variables
source .env

# Run the upgrade script
forge script ./script/Upgrade.s.sol \
  --rpc-url $SOPHON_TESTNET_RPC_URL \
  --private-key $WALLET_PRIVATE_KEY \
  --zksync \
  --broadcast \
  --verify \
  --verifier-api-key $ETHERSCAN_SOPHON_API_KEY \
  --verifier-url https://explorer.testnet.sophon.xyz/api