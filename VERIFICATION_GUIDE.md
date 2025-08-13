# Sophon Testnet Contract Verification Guide

## Deployed Contracts

### 1. MockUSDC
- **Address**: `0x10Af06Bb43F5ed51A289d22641135c6fC97987Ad`
- **Contract Name**: MockUSDC
- **Source File**: src/MockUSDC.sol
- **Compiler**: v0.8.24+commit.e11b9ed9
- **Optimization**: Yes, 200 runs
- **Constructor Arguments**: None
- **Verification URL**: https://explorer.testnet.sophon.xyz/address/0x10Af06Bb43F5ed51A289d22641135c6fC97987Ad?tab=contract

### 2. MockSOPH
- **Address**: `0x60863D4336d9aF2fB846209F2A8f6137ECA3eF1b`
- **Contract Name**: MockSOPH
- **Source File**: src/MockSOPH.sol
- **Compiler**: v0.8.24+commit.e11b9ed9
- **Optimization**: Yes, 200 runs
- **Constructor Arguments**: None
- **Verification URL**: https://explorer.testnet.sophon.xyz/address/0x60863D4336d9aF2fB846209F2A8f6137ECA3eF1b?tab=contract

### 3. StoreV2 (Implementation)
- **Address**: `0x838F60c6aC51F42a250312FFd2D72815Bba333fd`
- **Contract Name**: StoreV2
- **Source File**: src/StoreV2.sol
- **Compiler**: v0.8.24+commit.e11b9ed9
- **Optimization**: Yes, 200 runs
- **Constructor Arguments**: None
- **Verification URL**: https://explorer.testnet.sophon.xyz/address/0x838F60c6aC51F42a250312FFd2D72815Bba333fd?tab=contract

### 4. StoreV2 (Proxy)
- **Address**: `0x9af4b8A05B001A7dCbfD428C444f73Ff7d10d520`
- **Contract Name**: ERC1967Proxy
- **Source File**: @openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol
- **Compiler**: v0.8.24+commit.e11b9ed9
- **Optimization**: Yes, 200 runs
- **Constructor Arguments**: 
  - Implementation: `0x838F60c6aC51F42a250312FFd2D72815Bba333fd`
  - Data: Initialization calldata
- **Verification URL**: https://explorer.testnet.sophon.xyz/address/0x9af4b8A05B001A7dCbfD428C444f73Ff7d10d520?tab=contract

### 5. JobsV2 (Implementation)
- **Address**: `0x71d29D359950310815451C60264B8Abef4697B99`
- **Contract Name**: JobsV2
- **Source File**: src/JobsV2.sol
- **Compiler**: v0.8.24+commit.e11b9ed9
- **Optimization**: Yes, 200 runs
- **Constructor Arguments**: None
- **Verification URL**: https://explorer.testnet.sophon.xyz/address/0x71d29D359950310815451C60264B8Abef4697B99?tab=contract

### 6. JobsV2 (Proxy)
- **Address**: `0x935f8Fd143720B337c521354a545a342DF584D18`
- **Contract Name**: ERC1967Proxy
- **Source File**: @openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol
- **Compiler**: v0.8.24+commit.e11b9ed9
- **Optimization**: Yes, 200 runs
- **Constructor Arguments**:
  - Implementation: `0x71d29D359950310815451C60264B8Abef4697B99`
  - Data: Initialization calldata
- **Verification URL**: https://explorer.testnet.sophon.xyz/address/0x935f8Fd143720B337c521354a545a342DF584D18?tab=contract

## Manual Verification Steps

1. Go to the verification URL for each contract
2. Click on "Verify & Publish" or "Verify Contract" button
3. Fill in the following information:
   - Contract Address: (already filled)
   - Contract Name: As listed above
   - Compiler Version: v0.8.24+commit.e11b9ed9
   - Optimization: Enabled
   - Runs: 200
   - EVM Version: Cancun (or auto-detect)
4. For source code:
   - Use the flattened files in the `/flattened` directory
   - Or upload the source files with proper import structure
5. For constructor arguments (if any):
   - Leave empty for implementation contracts
   - For proxies, use the encoded constructor arguments

## Flattened Source Files

All flattened source files are available in the `/flattened` directory:
- `flattened/MockUSDC.sol`
- `flattened/MockSOPH.sol`
- `flattened/StoreV2.sol`
- `flattened/JobsV2.sol`

## Important Notes

- The Sophon testnet explorer may require manual verification through their web interface
- Automatic verification via API is currently not fully supported
- All contracts were deployed with Foundry using Solidity 0.8.24
- Optimization was enabled with 200 runs