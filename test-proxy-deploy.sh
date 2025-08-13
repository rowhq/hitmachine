#!/bin/bash

# Test deploying just a proxy with paymaster

set -e
source .env

echo "Testing proxy deployment with paymaster..."

# We already have these deployed:
STORE_IMPL="0x7B9470Ed68b958c7ba3127da4D78E957e88CA538"
MOCK_USDC="0x81881Be46bF188623c599268206Cca70Eeb15B61"
DEPLOYER="0x4f2CBdDe7dc571e31b2BFE013ba0e2DB50f22ead"
PAYMASTER="0x98546B226dbbA8230cf620635a1e4ab01F6A99B2"

# Create initialization data
INIT_DATA=$(cast calldata "initialize(address,address,uint256)" $MOCK_USDC $DEPLOYER 32000000)
echo "Init data: $INIT_DATA"

# Try deploying the proxy with paymaster
echo ""
echo "Deploying ERC1967Proxy with paymaster..."
forge create lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy \
    --constructor-args $STORE_IMPL $INIT_DATA \
    --rpc-url https://rpc.testnet.sophon.xyz \
    --private-key $WALLET_PRIVATE_KEY \
    --zksync \
    --zk-paymaster-address $PAYMASTER \
    --zk-paymaster-input $(cast calldata "general(bytes)" "0x")