# Include .env file if it exists
-include .env

# Default network
NETWORK ?= sophon_mainnet

# Build contracts
build:
	forge build

# Clean build artifacts
clean:
	forge clean

# Run tests
test:
	forge test -vvv

# Run tests with gas reporting
test-gas:
	forge test --gas-report

# Deploy contracts (non-upgradeable)
deploy-legacy:
	forge script script/Deploy.s.sol:DeployScript --rpc-url $(NETWORK) --broadcast --verify -vvvv

# Deploy upgradeable contracts
deploy:
	forge script script/DeployUpgradeable.s.sol:DeployUpgradeableScript --rpc-url $(NETWORK) --broadcast --verify -vvvv

# Deploy upgradeable to testnet (with full setup)
deploy-testnet:
	@echo "Running full testnet deployment with ABIs and frontend setup..."
	./deploy-to-testnet.sh

# Deploy upgradeable to testnet (manual)
deploy-testnet-manual:
	forge script script/DeployUpgradeable.s.sol:DeployUpgradeableScript --rpc-url sophon_testnet --broadcast --verify -vvvv

# Deploy upgradeable to mainnet
deploy-mainnet:
	forge script script/DeployUpgradeable.s.sol:DeployUpgradeableScript --rpc-url sophon_mainnet --broadcast --verify -vvvv

# Configure contracts (grant roles, etc.)
configure:
	forge script script/Configure.s.sol:ConfigureScript --rpc-url $(NETWORK) --broadcast -vvvv

# Update album price
update-price:
	@read -p "Enter new price in USDC (e.g., 0.01): " price; \
	price_wei=$$(echo "$$price * 1000000" | bc); \
	forge script script/Configure.s.sol:ConfigureScript --sig "updatePrice(uint256)" $$price_wei --rpc-url $(NETWORK) --broadcast -vvvv

# Verify contract
verify:
	@read -p "Enter contract address: " addr; \
	@read -p "Enter constructor args (space separated): " args; \
	forge verify-contract $$addr $(CONTRACT) --etherscan-api-key $(ETHERSCAN_SOPHON_API_KEY) --chain $(NETWORK) --constructor-args $$args

# Install dependencies
install:
	forge install

# Update dependencies
update:
	forge update

# Format code
format:
	forge fmt

# Check formatting
format-check:
	forge fmt --check

# Generate ABI files
abi:
	@mkdir -p abi
	@forge inspect Store abi > abi/Store.json
	@forge inspect Jobs abi > abi/Jobs.json
	@echo "ABI files generated in abi/"

# Slither security analysis (requires slither-analyzer)
slither:
	slither src/ --config-file slither.config.json

# Help
help:
	@echo "Available commands:"
	@echo "  make build          - Build contracts"
	@echo "  make clean          - Clean build artifacts"
	@echo "  make test           - Run tests"
	@echo "  make test-gas       - Run tests with gas reporting"
	@echo "  make deploy         - Deploy contracts to default network"
	@echo "  make deploy-testnet - Deploy to Sophon testnet"
	@echo "  make deploy-mainnet - Deploy to Sophon mainnet"
	@echo "  make configure      - Configure deployed contracts"
	@echo "  make update-price   - Update album price"
	@echo "  make verify         - Verify contract on Etherscan"
	@echo "  make install        - Install dependencies"
	@echo "  make update         - Update dependencies"
	@echo "  make format         - Format code"
	@echo "  make format-check   - Check code formatting"
	@echo "  make abi            - Generate ABI files"
	@echo "  make slither        - Run Slither security analysis"

.PHONY: build clean test test-gas deploy deploy-testnet deploy-mainnet configure update-price verify install update format format-check abi slither help