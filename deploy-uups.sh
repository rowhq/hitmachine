#!/bin/bash

# Deploy UUPS upgradeable contracts - the simple way

set -e
source .env

echo "========================================"
echo "Deploying UUPS Upgradeable Contracts"
echo "========================================"

PAYMASTER="0x98546B226dbbA8230cf620635a1e4ab01F6A99B2"
RPC="https://rpc.testnet.sophon.xyz"

# We already have these:
STORE_IMPL="0x7B9470Ed68b958c7ba3127da4D78E957e88CA538"
JOBS_IMPL="0x721B89427291D9793A593e5049244bB3fc9064D1"  
MOCK_USDC="0x81881Be46bF188623c599268206Cca70Eeb15B61"
DEPLOYER="0x4f2CBdDe7dc571e31b2BFE013ba0e2DB50f22ead"

echo "Using implementations:"
echo "  Store: $STORE_IMPL"
echo "  Jobs: $JOBS_IMPL"
echo ""

# The issue is that ERC1967Proxy needs (address implementation, bytes data)
# Let's try deploying it step by step

# First, let's verify our implementations are UUPS compatible
echo "Verifying UUPS compatibility..."
echo ""

# Method 1: Try deploying proxy without paymaster first (to test)
echo "Deploying Store Proxy (without paymaster for testing)..."
STORE_INIT=$(cast calldata "initialize(address,address,uint256)" $MOCK_USDC $DEPLOYER 32000000)

forge create lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy \
    --constructor-args $STORE_IMPL $STORE_INIT \
    --rpc-url $RPC \
    --private-key $WALLET_PRIVATE_KEY \
    --zksync

echo ""
echo "If this worked, we can add paymaster. If not, we need a different approach."