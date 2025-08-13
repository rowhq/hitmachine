#!/bin/bash

# Deploy proxies using ProxyDeployer helper contract with PAYMASTER

set -e
source .env

echo "========================================"
echo "Deploying Proxies with PAYMASTER"
echo "========================================"

# Existing deployed contracts
STORE_IMPL="0x7B9470Ed68b958c7ba3127da4D78E957e88CA538"
JOBS_IMPL="0x721B89427291D9793A593e5049244bB3fc9064D1"  
MOCK_USDC="0x81881Be46bF188623c599268206Cca70Eeb15B61"
DEPLOYER="0x4f2CBdDe7dc571e31b2BFE013ba0e2DB50f22ead"
PAYMASTER="0x98546B226dbbA8230cf620635a1e4ab01F6A99B2"

echo "Using existing implementations:"
echo "  Store: $STORE_IMPL"
echo "  Jobs: $JOBS_IMPL"
echo "  USDC: $MOCK_USDC"
echo ""

# Deploy ProxyDeployer which will create both proxies
echo "Deploying ProxyDeployer (which creates proxies)..."
DEPLOYER_OUTPUT=$(forge create src/ProxyDeployer.sol:ProxyDeployer \
    --constructor-args $STORE_IMPL $JOBS_IMPL $MOCK_USDC $DEPLOYER \
    --rpc-url https://rpc.testnet.sophon.xyz \
    --private-key $WALLET_PRIVATE_KEY \
    --zksync \
    --zk-paymaster-address $PAYMASTER \
    --zk-paymaster-input $(cast calldata "general(bytes)" "0x") \
    2>&1)

echo "$DEPLOYER_OUTPUT"

# Extract the deployed address
PROXY_DEPLOYER=$(echo "$DEPLOYER_OUTPUT" | grep -oE "Deployed to: 0x[a-fA-F0-9]{40}" | cut -d' ' -f3)

if [ -z "$PROXY_DEPLOYER" ]; then
    echo "❌ Failed to deploy ProxyDeployer"
    exit 1
fi

echo ""
echo "✅ ProxyDeployer deployed at: $PROXY_DEPLOYER"

# Get the proxy addresses
echo "Reading proxy addresses..."
STORE_PROXY=$(cast call $PROXY_DEPLOYER "storeProxy()" --rpc-url https://rpc.testnet.sophon.xyz | sed 's/0x000000000000000000000000/0x/')
JOBS_PROXY=$(cast call $PROXY_DEPLOYER "jobsProxy()" --rpc-url https://rpc.testnet.sophon.xyz | sed 's/0x000000000000000000000000/0x/')

echo "Store Proxy: $STORE_PROXY"
echo "Jobs Proxy: $JOBS_PROXY"

# Verify the proxies work
echo ""
echo "Verifying deployment..."
PRICE=$(cast call $STORE_PROXY "giftcardPrice()" --rpc-url https://rpc.testnet.sophon.xyz 2>/dev/null || echo "FAILED")
echo "Gift card price: $PRICE (should be 0x0000000000000000000000000000000000000000000000000000000001e84800)"

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

# Update frontend
cat > frontend/.env.local << EOF
# Auto-generated from deploy-with-proxies.sh
NEXT_PUBLIC_STORE_CONTRACT=$STORE_PROXY
NEXT_PUBLIC_JOBS_CONTRACT=$JOBS_PROXY
NEXT_PUBLIC_USDC_ADDRESS=$MOCK_USDC
NEXT_PUBLIC_NETWORK=testnet
EOF

echo ""
echo "========================================"
echo "✅ DEPLOYMENT COMPLETE WITH PROXIES!"
echo "========================================"
echo ""
echo "Upgradeable contracts deployed:"
echo "  Store Proxy: $STORE_PROXY"
echo "  Jobs Proxy: $JOBS_PROXY"
echo ""
echo "ALL DEPLOYED WITH PAYMASTER (GASLESS)!"