#!/bin/bash

# Sophon Testnet Deployment with Paymaster (based on official docs)

set -e

echo "========================================"
echo "Sophon Testnet Deployment (Gasless)"
echo "========================================"

# Load environment variables
source .env

# Configuration
PAYMASTER_ADDRESS="0x98546B226dbbA8230cf620635a1e4ab01F6A99B2"
RPC_URL=${SOPHON_TESTNET_RPC_URL:-"https://rpc.testnet.sophon.xyz"}
DEPLOYER=$(cast wallet address --private-key $WALLET_PRIVATE_KEY)

echo "Deployer: $DEPLOYER"
echo "Paymaster: $PAYMASTER_ADDRESS"
echo ""

# 1. Deploy MockUSDC
echo "1. Deploying MockUSDC..."
MOCK_USDC=$(forge create src/MockUSDC.sol:MockUSDC \
    --rpc-url $RPC_URL \
    --private-key $WALLET_PRIVATE_KEY \
    --zksync \
    --zk-paymaster-address $PAYMASTER_ADDRESS \
    --zk-paymaster-input $(cast calldata "general(bytes)" "0x") \
    --json | jq -r '.deployedTo')
echo "   MockUSDC: $MOCK_USDC"

# 2. Deploy Store Implementation
echo "2. Deploying Store Implementation..."
STORE_IMPL=$(forge create src/StoreV2.sol:StoreV2 \
    --rpc-url $RPC_URL \
    --private-key $WALLET_PRIVATE_KEY \
    --zksync \
    --zk-paymaster-address $PAYMASTER_ADDRESS \
    --zk-paymaster-input $(cast calldata "general(bytes)" "0x") \
    --json | jq -r '.deployedTo')
echo "   Store Implementation: $STORE_IMPL"

# 3. Deploy Jobs Implementation
echo "3. Deploying Jobs Implementation..."
JOBS_IMPL=$(forge create src/JobsV2.sol:JobsV2 \
    --rpc-url $RPC_URL \
    --private-key $WALLET_PRIVATE_KEY \
    --zksync \
    --zk-paymaster-address $PAYMASTER_ADDRESS \
    --zk-paymaster-input $(cast calldata "general(bytes)" "0x") \
    --json | jq -r '.deployedTo')
echo "   Jobs Implementation: $JOBS_IMPL"

# 4. Deploy proxies separately using a simple deployment script
echo "4. Deploying proxies..."
cat > temp-deploy-proxies.sol << EOF
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployProxies {
    address public storeProxy;
    address public jobsProxy;
    
    constructor(
        address storeImpl,
        address jobsImpl,
        address usdc,
        address admin
    ) {
        // Deploy Store proxy
        bytes memory storeData = abi.encodeWithSignature(
            "initialize(address,address,uint256)",
            usdc,
            admin,
            32000000
        );
        storeProxy = address(new ERC1967Proxy(storeImpl, storeData));
        
        // Deploy Jobs proxy
        bytes memory jobsData = abi.encodeWithSignature(
            "initialize(address,address)",
            usdc,
            admin
        );
        jobsProxy = address(new ERC1967Proxy(jobsImpl, jobsData));
    }
}
EOF

# Deploy the proxy deployer contract
PROXY_DEPLOYER=$(forge create temp-deploy-proxies.sol:DeployProxies \
    --constructor-args $STORE_IMPL $JOBS_IMPL $MOCK_USDC $DEPLOYER \
    --rpc-url $RPC_URL \
    --private-key $WALLET_PRIVATE_KEY \
    --zksync \
    --zk-paymaster-address $PAYMASTER_ADDRESS \
    --zk-paymaster-input $(cast calldata "general(bytes)" "0x") \
    --json | jq -r '.deployedTo')

# Get proxy addresses from the deployer contract
STORE_PROXY=$(cast call $PROXY_DEPLOYER "storeProxy()" --rpc-url $RPC_URL)
JOBS_PROXY=$(cast call $PROXY_DEPLOYER "jobsProxy()" --rpc-url $RPC_URL)

echo "   Store Proxy: $STORE_PROXY"
echo "   Jobs Proxy: $JOBS_PROXY"

# 5. Mint test USDC
echo "5. Minting test USDC..."
cast send $MOCK_USDC "mintTo(address,uint256)" $DEPLOYER 10000000000 \
    --private-key $WALLET_PRIVATE_KEY \
    --rpc-url $RPC_URL
cast send $MOCK_USDC "mintTo(address,uint256)" $JOBS_PROXY 10000000000 \
    --private-key $WALLET_PRIVATE_KEY \
    --rpc-url $RPC_URL

# Save deployment info
cat > deployed-addresses-testnet.txt << EOF
# Sophon Testnet Deployment
STORE_PROXY=$STORE_PROXY
STORE_IMPL=$STORE_IMPL
JOBS_PROXY=$JOBS_PROXY
JOBS_IMPL=$JOBS_IMPL
USDC_ADDRESS=$MOCK_USDC
ADMIN=$DEPLOYER
EOF

# Clean up temp file
rm temp-deploy-proxies.sol

echo ""
echo "========================================"
echo "✅ Deployment Complete!"
echo "========================================"
echo ""
echo "Contracts:"
echo "  MockUSDC: $MOCK_USDC"
echo "  Store Proxy: $STORE_PROXY"
echo "  Jobs Proxy: $JOBS_PROXY"
echo ""
echo "Saved to: deployed-addresses-testnet.txt"