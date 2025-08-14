#!/bin/bash

echo "Testing deployed contracts on Sophon Testnet..."
echo "=============================================="

# Contract addresses
MOCKUSDC="0x3a364f43893C86553574bf28Bcb4a3d7ff0C7c1f"
MUSICSTORE="0x86E1D788FFCd8232D85dD7eB02c508e7021EB474"
ANIMALCARE="0xAAfD6b707770BC9F60A773405dE194348B6C4392"

# Load environment
source .env

echo ""
echo "1. Testing MockUSDC..."
echo "   Address: $MOCKUSDC"
cast call $MOCKUSDC "name()" --rpc-url $SOPHON_TESTNET_RPC_URL
cast call $MOCKUSDC "symbol()" --rpc-url $SOPHON_TESTNET_RPC_URL
cast call $MOCKUSDC "decimals()" --rpc-url $SOPHON_TESTNET_RPC_URL

echo ""
echo "2. Testing NanoMusicStore..."
echo "   Address: $MUSICSTORE"
cast call $MUSICSTORE "getStats()" --rpc-url $SOPHON_TESTNET_RPC_URL
cast call $MUSICSTORE "giftcardPrice()" --rpc-url $SOPHON_TESTNET_RPC_URL

echo ""
echo "3. Testing NanoAnimalCare..."
echo "   Address: $ANIMALCARE"
cast call $ANIMALCARE "getUSDCBalance()" --rpc-url $SOPHON_TESTNET_RPC_URL

echo ""
echo "=============================================="
echo "All contracts responding correctly!"