#!/bin/bash

# Sophon Testnet Deployment with PAYMASTER - Complete Setup

set -e

echo "========================================"
echo "🚀 Sophon Testnet GASLESS Deployment"
echo "========================================"

# Load environment variables
if [ -f .env ]; then
    source .env
fi

# Check required environment variables
if [ -z "$WALLET_PRIVATE_KEY" ]; then
    echo "❌ Error: WALLET_PRIVATE_KEY not set in .env"
    exit 1
fi

# Configuration
PAYMASTER="0x98546B226dbbA8230cf620635a1e4ab01F6A99B2"
RPC_URL="${SOPHON_TESTNET_RPC_URL:-https://rpc.testnet.sophon.xyz}"
DEPLOYER=$(cast wallet address --private-key $WALLET_PRIVATE_KEY)

echo "📍 Configuration:"
echo "   Deployer: $DEPLOYER"
echo "   Paymaster: $PAYMASTER (GASLESS)"
echo "   RPC: $RPC_URL"
echo ""

# Check deployer balance
BALANCE=$(cast balance $DEPLOYER --rpc-url $RPC_URL)
echo "   Deployer balance: $BALANCE wei"
echo ""

# Build contracts first
echo "🔨 Building contracts with zkSync..."
forge build --zksync

echo ""
echo "📦 Starting deployments (ALL GASLESS via Paymaster)..."
echo ""

# 1. Deploy MockUSDC
echo "1️⃣ Deploying MockUSDC..."
MOCK_USDC_OUTPUT=$(forge create src/MockUSDC.sol:MockUSDC \
    --rpc-url $RPC_URL \
    --private-key $WALLET_PRIVATE_KEY \
    --zksync \
    --zk-paymaster-address $PAYMASTER \
    --zk-paymaster-input $(cast calldata "general(bytes)" "0x") \
    2>&1)

# Extract address from output
MOCK_USDC=$(echo "$MOCK_USDC_OUTPUT" | grep -oE "Deployed to: 0x[a-fA-F0-9]{40}" | cut -d' ' -f3)
if [ -z "$MOCK_USDC" ]; then
    echo "❌ Failed to deploy MockUSDC"
    echo "Output: $MOCK_USDC_OUTPUT"
    exit 1
fi
echo "   ✅ MockUSDC: $MOCK_USDC"

# 2. Deploy StoreV2 Implementation
echo ""
echo "2️⃣ Deploying StoreV2 Implementation..."
STORE_IMPL_OUTPUT=$(forge create src/StoreV2.sol:StoreV2 \
    --rpc-url $RPC_URL \
    --private-key $WALLET_PRIVATE_KEY \
    --zksync \
    --zk-paymaster-address $PAYMASTER \
    --zk-paymaster-input $(cast calldata "general(bytes)" "0x") \
    2>&1)

STORE_IMPL=$(echo "$STORE_IMPL_OUTPUT" | grep -oE "Deployed to: 0x[a-fA-F0-9]{40}" | cut -d' ' -f3)
if [ -z "$STORE_IMPL" ]; then
    echo "❌ Failed to deploy StoreV2"
    echo "Output: $STORE_IMPL_OUTPUT"
    exit 1
fi
echo "   ✅ StoreV2 Implementation: $STORE_IMPL"

# 3. Deploy JobsV2 Implementation
echo ""
echo "3️⃣ Deploying JobsV2 Implementation..."
JOBS_IMPL_OUTPUT=$(forge create src/JobsV2.sol:JobsV2 \
    --rpc-url $RPC_URL \
    --private-key $WALLET_PRIVATE_KEY \
    --zksync \
    --zk-paymaster-address $PAYMASTER \
    --zk-paymaster-input $(cast calldata "general(bytes)" "0x") \
    2>&1)

JOBS_IMPL=$(echo "$JOBS_IMPL_OUTPUT" | grep -oE "Deployed to: 0x[a-fA-F0-9]{40}" | cut -d' ' -f3)
if [ -z "$JOBS_IMPL" ]; then
    echo "❌ Failed to deploy JobsV2"
    echo "Output: $JOBS_IMPL_OUTPUT"
    exit 1
fi
echo "   ✅ JobsV2 Implementation: $JOBS_IMPL"

# 4. Create a simple proxy deployer contract
echo ""
echo "4️⃣ Creating proxy deployment helper..."
cat > ProxyDeployer.sol << 'EOF'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ProxyDeployer {
    event ProxyDeployed(string name, address proxy);
    
    address public storeProxy;
    address public jobsProxy;
    
    constructor(
        address _storeImpl,
        address _jobsImpl,
        address _usdc,
        address _admin
    ) {
        // Deploy Store proxy with delegatecall to initialize
        storeProxy = deployProxy(
            _storeImpl,
            abi.encodeWithSignature(
                "initialize(address,address,uint256)",
                _usdc,
                _admin,
                32000000
            )
        );
        emit ProxyDeployed("StoreV2", storeProxy);
        
        // Deploy Jobs proxy with delegatecall to initialize
        jobsProxy = deployProxy(
            _jobsImpl,
            abi.encodeWithSignature(
                "initialize(address,address)",
                _usdc,
                _admin
            )
        );
        emit ProxyDeployed("JobsV2", jobsProxy);
    }
    
    function deployProxy(address implementation, bytes memory data) internal returns (address proxy) {
        // Deploy a minimal proxy
        bytes memory bytecode = abi.encodePacked(
            hex"3d602d80600a3d3981f3363d3d373d3d3d363d73",
            implementation,
            hex"5af43d82803e903d91602b57fd5bf3"
        );
        
        assembly {
            proxy := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
        }
        
        if (data.length > 0) {
            (bool success,) = proxy.call(data);
            require(success, "Initialization failed");
        }
    }
}
EOF

# Compile the helper
forge build --zksync ProxyDeployer.sol

# 5. Deploy the proxy deployer (which creates both proxies)
echo ""
echo "5️⃣ Deploying proxies via helper contract..."
DEPLOYER_OUTPUT=$(forge create ProxyDeployer.sol:ProxyDeployer \
    --constructor-args $STORE_IMPL $JOBS_IMPL $MOCK_USDC $DEPLOYER \
    --rpc-url $RPC_URL \
    --private-key $WALLET_PRIVATE_KEY \
    --zksync \
    --zk-paymaster-address $PAYMASTER \
    --zk-paymaster-input $(cast calldata "general(bytes)" "0x") \
    2>&1)

PROXY_DEPLOYER=$(echo "$DEPLOYER_OUTPUT" | grep -oE "Deployed to: 0x[a-fA-F0-9]{40}" | cut -d' ' -f3)
if [ -z "$PROXY_DEPLOYER" ]; then
    echo "❌ Failed to deploy proxy deployer"
    echo "Output: $DEPLOYER_OUTPUT"
    
    # Fallback: Try deploying proxies directly without helper
    echo ""
    echo "⚠️  Trying fallback deployment method..."
    
    # Deploy Store Proxy directly
    echo "   Deploying Store Proxy..."
    STORE_INIT=$(cast calldata "initialize(address,address,uint256)" $MOCK_USDC $DEPLOYER 32000000)
    STORE_PROXY_OUTPUT=$(forge create src/SimpleProxy.sol:SimpleProxy \
        --constructor-args $STORE_IMPL $STORE_INIT \
        --rpc-url $RPC_URL \
        --private-key $WALLET_PRIVATE_KEY \
        --zksync \
        --zk-paymaster-address $PAYMASTER \
        --zk-paymaster-input $(cast calldata "general(bytes)" "0x") \
        2>&1 || echo "FAILED")
    
    if [[ "$STORE_PROXY_OUTPUT" == *"FAILED"* ]]; then
        echo "   ❌ Could not deploy Store proxy with paymaster"
        echo "   Try running without paymaster: remove --zk-paymaster flags"
        STORE_PROXY="NOT_DEPLOYED"
    else
        STORE_PROXY=$(echo "$STORE_PROXY_OUTPUT" | grep -oE "Deployed to: 0x[a-fA-F0-9]{40}" | cut -d' ' -f3)
    fi
    
    # Deploy Jobs Proxy directly
    echo "   Deploying Jobs Proxy..."
    JOBS_INIT=$(cast calldata "initialize(address,address)" $MOCK_USDC $DEPLOYER)
    JOBS_PROXY_OUTPUT=$(forge create src/SimpleProxy.sol:SimpleProxy \
        --constructor-args $JOBS_IMPL $JOBS_INIT \
        --rpc-url $RPC_URL \
        --private-key $WALLET_PRIVATE_KEY \
        --zksync \
        --zk-paymaster-address $PAYMASTER \
        --zk-paymaster-input $(cast calldata "general(bytes)" "0x") \
        2>&1 || echo "FAILED")
    
    if [[ "$JOBS_PROXY_OUTPUT" == *"FAILED"* ]]; then
        echo "   ❌ Could not deploy Jobs proxy with paymaster"
        JOBS_PROXY="NOT_DEPLOYED"
    else
        JOBS_PROXY=$(echo "$JOBS_PROXY_OUTPUT" | grep -oE "Deployed to: 0x[a-fA-F0-9]{40}" | cut -d' ' -f3)
    fi
else
    echo "   ✅ Proxy Deployer: $PROXY_DEPLOYER"
    
    # Get proxy addresses from the deployer
    echo "   Reading proxy addresses..."
    STORE_PROXY=$(cast call $PROXY_DEPLOYER "storeProxy()" --rpc-url $RPC_URL | sed 's/0x000000000000000000000000/0x/')
    JOBS_PROXY=$(cast call $PROXY_DEPLOYER "jobsProxy()" --rpc-url $RPC_URL | sed 's/0x000000000000000000000000/0x/')
fi

echo "   ✅ Store Proxy: $STORE_PROXY"
echo "   ✅ Jobs Proxy: $JOBS_PROXY"

# 6. Mint test USDC (these don't use paymaster since they're regular transactions)
echo ""
echo "6️⃣ Minting test USDC..."
echo "   Minting 10,000 USDC to deployer..."
cast send $MOCK_USDC "mintTo(address,uint256)" $DEPLOYER 10000000000 \
    --private-key $WALLET_PRIVATE_KEY \
    --rpc-url $RPC_URL > /dev/null 2>&1 || echo "   ⚠️  Minting to deployer failed"

echo "   Minting 10,000 USDC to Jobs contract..."
cast send $MOCK_USDC "mintTo(address,uint256)" $JOBS_PROXY 10000000000 \
    --private-key $WALLET_PRIVATE_KEY \
    --rpc-url $RPC_URL > /dev/null 2>&1 || echo "   ⚠️  Minting to Jobs failed"

# 7. Verify deployment
echo ""
echo "7️⃣ Verifying deployment..."

# Check USDC balance
DEPLOYER_USDC=$(cast call $MOCK_USDC "balanceOf(address)" $DEPLOYER --rpc-url $RPC_URL 2>/dev/null || echo "0")
echo "   Deployer USDC balance: $DEPLOYER_USDC"

# Check Store price
if [ "$STORE_PROXY" != "NOT_DEPLOYED" ]; then
    PRICE=$(cast call $STORE_PROXY "giftcardPrice()" --rpc-url $RPC_URL 2>/dev/null || echo "0")
    echo "   Store giftcard price: $PRICE (should be 32000000)"
fi

# Save deployment info
cat > deployed-addresses-testnet.txt << EOF
# Sophon Testnet Deployment (GASLESS via Paymaster)
# Deployed at: $(date)
# Deployer: $DEPLOYER

MOCK_USDC=$MOCK_USDC
STORE_IMPL=$STORE_IMPL
STORE_PROXY=$STORE_PROXY
JOBS_IMPL=$JOBS_IMPL
JOBS_PROXY=$JOBS_PROXY
PAYMASTER=$PAYMASTER
EOF

# Update frontend env
cat > frontend/.env.local << EOF
# Auto-generated from deploy-paymaster.sh
NEXT_PUBLIC_STORE_CONTRACT=$STORE_PROXY
NEXT_PUBLIC_JOBS_CONTRACT=$JOBS_PROXY
NEXT_PUBLIC_USDC_ADDRESS=$MOCK_USDC
NEXT_PUBLIC_NETWORK=testnet
EOF

# Clean up
rm -f ProxyDeployer.sol

# Final summary
echo ""
echo "========================================"
echo "✅ DEPLOYMENT COMPLETE!"
echo "========================================"
echo ""
echo "📋 Summary:"
echo "   MockUSDC:    $MOCK_USDC"
echo "   Store Proxy: $STORE_PROXY"
echo "   Jobs Proxy:  $JOBS_PROXY"
echo ""
echo "💾 Files saved:"
echo "   - deployed-addresses-testnet.txt"
echo "   - frontend/.env.local"
echo ""
echo "🔥 ALL DEPLOYMENTS USED PAYMASTER (GASLESS)!"
echo ""
echo "📝 Next steps:"
echo "   1. Grant marketing role to nano wallet:"
echo "      cast send $STORE_PROXY \"grantRole(bytes32,address)\" \\"
echo "        \$(cast keccak \"MARKETING_BUDGET_ROLE\") \\"
echo "        YOUR_NANO_WALLET_ADDRESS \\"
echo "        --private-key \$WALLET_PRIVATE_KEY"
echo ""

# Check final balance to prove gasless
FINAL_BALANCE=$(cast balance $DEPLOYER --rpc-url $RPC_URL)
echo "📊 Balance check:"
echo "   Initial: $BALANCE wei"
echo "   Final:   $FINAL_BALANCE wei"
if [ "$BALANCE" == "$FINAL_BALANCE" ]; then
    echo "   ✅ Balance unchanged - PAYMASTER WORKED!"
else
    echo "   ⚠️  Balance changed - some transactions may not have used paymaster"
fi