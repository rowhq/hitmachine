#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface ContractInfo {
  name: string;
  address: string;
  constructorArgs?: string;
  isProxy?: boolean;
  implementation?: string;
}

interface VerificationRequest {
  address: string;
  sourceCode: string;
  contractName: string;
  compilerVersion: string;
  optimizationUsed: boolean;
  runs: number;
  constructorArguments?: string;
  evmVersion: string;
  libraryName1?: string;
  libraryAddress1?: string;
}

const CONTRACTS: ContractInfo[] = [
  {
    name: 'MockUSDC',
    address: '0x3a364f43893C86553574bf28Bcb4a3d7ff0C7c1f',
  },
  {
    name: 'NanoMusicStore',
    address: '0x46dF1b6AAFC71cf6Cb231b57B4A51996DDb11Bb6',
    isProxy: false,
    implementation: '0x46dF1b6AAFC71cf6Cb231b57B4A51996DDb11Bb6',
  },
  {
    name: 'ERC1967Proxy:NanoMusicStore',
    address: '0x86E1D788FFCd8232D85dD7eB02c508e7021EB474',
    constructorArgs: '00000000000000000000000046df1b6aafc71cf6cb231b57b4a51996ddb11bb6000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000641794bb3c0000000000000000000000003a364f43893c86553574bf28bcb4a3d7ff0c7c1f0000000000000000000000004f2cbdde7dc571e31b2bfe013ba0e2db50f22ead0000000000000000000000000000000000000000000000000000000001e8480000000000000000000000000000000000000000000000000000000000',
    isProxy: true,
  },
  {
    name: 'NanoAnimalCare',
    address: '0xDBc508c96aC737C9a856B0C98f5281E16C9c8F35',
    isProxy: false,
    implementation: '0xDBc508c96aC737C9a856B0C98f5281E16C9c8F35',
  },
  {
    name: 'ERC1967Proxy:NanoAnimalCare',
    address: '0xAAfD6b707770BC9F60A773405dE194348B6C4392',
    constructorArgs: '000000000000000000000000dbc508c96ac737c9a856b0c98f5281e16c9c8f3500000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000044485cc9550000000000000000000000003a364f43893c86553574bf28bcb4a3d7ff0c7c1f0000000000000000000000004f2cbdde7dc571e31b2bfe013ba0e2db50f22ead00000000000000000000000000000000000000000000000000000000',
    isProxy: true,
  },
];

const API_KEY = process.env.ETHERSCAN_SOPHON_API_KEY;
const API_URL = 'https://api-explorer.sophon.xyz/api';
const COMPILER_VERSION = 'v0.8.24+commit.e11b9ed9';
const ZKSOLC_VERSION = '1.5.15';

async function flattenContract(contractPath: string): Promise<string> {
  try {
    const output = execSync(`forge flatten ${contractPath}`, { encoding: 'utf8' });
    return output;
  } catch (error) {
    console.error(`Error flattening ${contractPath}:`, error);
    throw error;
  }
}

async function verifyContract(contract: ContractInfo) {
  console.log(`\nVerifying ${contract.name} at ${contract.address}...`);

  try {
    // Determine the source file path
    let sourcePath: string;
    let contractName: string;

    if (contract.name.startsWith('ERC1967Proxy')) {
      sourcePath = 'lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol';
      contractName = 'ERC1967Proxy';
    } else {
      sourcePath = `src/${contract.name}.sol`;
      contractName = contract.name;
    }

    // Flatten the contract
    console.log(`Flattening ${sourcePath}...`);
    const sourceCode = await flattenContract(sourcePath);

    // Prepare verification request
    const verificationData: VerificationRequest = {
      address: contract.address,
      sourceCode: sourceCode,
      contractName: contractName,
      compilerVersion: COMPILER_VERSION,
      optimizationUsed: true,
      runs: 200,
      evmVersion: 'cancun',
    };

    if (contract.constructorArgs) {
      verificationData.constructorArguments = contract.constructorArgs;
    }

    // Send verification request
    console.log('Sending verification request...');
    const response = await fetch(`${API_URL}/contract/verifysourcecode`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apikey: API_KEY,
        module: 'contract',
        action: 'verifysourcecode',
        ...verificationData,
      }),
    });

    const result = await response.json();
    
    if (result.status === '1') {
      console.log(`✅ Verification request submitted successfully!`);
      console.log(`GUID: ${result.result}`);
      
      // Check verification status
      await checkVerificationStatus(result.result);
    } else {
      console.error(`❌ Verification failed: ${result.message || result.result}`);
    }
  } catch (error) {
    console.error(`Error verifying ${contract.name}:`, error);
  }
}

async function checkVerificationStatus(guid: string, attempts = 0): Promise<void> {
  if (attempts > 30) {
    console.log('⏱️  Verification is taking longer than expected. Please check manually.');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/contract/checkverifystatus?guid=${guid}&apikey=${API_KEY}`);
    const result = await response.json();

    if (result.status === '1') {
      console.log('✅ Contract verified successfully!');
    } else if (result.result === 'Pending in queue') {
      process.stdout.write('.');
      await new Promise(resolve => setTimeout(resolve, 2000));
      await checkVerificationStatus(guid, attempts + 1);
    } else {
      console.error(`\n❌ Verification failed: ${result.result}`);
    }
  } catch (error) {
    console.error('Error checking verification status:', error);
  }
}

async function main() {
  console.log('🚀 Sophon Contract Verification Script');
  console.log('=====================================');

  if (!API_KEY || API_KEY === 'YOUR_SOPHSCAN_API_KEY_HERE') {
    console.error('❌ Please set ETHERSCAN_SOPHON_API_KEY in your .env file');
    console.error('   Get your API key from: https://explorer.testnet.sophon.xyz');
    process.exit(1);
  }

  console.log(`📍 Network: Sophon Testnet (Chain ID: 531050104)`);
  console.log(`🔧 Compiler: ${COMPILER_VERSION}`);
  console.log(`🔧 zkSolc: ${ZKSOLC_VERSION}`);
  console.log(`🔧 Optimization: Enabled (200 runs)`);

  // Verify each contract
  for (const contract of CONTRACTS) {
    await verifyContract(contract);
    // Add delay between verifications to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  console.log('\n✨ Verification process complete!');
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});