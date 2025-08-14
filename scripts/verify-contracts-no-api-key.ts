#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface ContractInfo {
  name: string;
  address: string;
  sourcePath: string;
  contractName: string;
  constructorArgs?: string;
}

const CONTRACTS: ContractInfo[] = [
  {
    name: 'MockUSDC',
    address: '0x3a364f43893C86553574bf28Bcb4a3d7ff0C7c1f',
    sourcePath: 'src/MockUSDC.sol',
    contractName: 'MockUSDC',
  },
  {
    name: 'NanoMusicStore Implementation',
    address: '0x46dF1b6AAFC71cf6Cb231b57B4A51996DDb11Bb6',
    sourcePath: 'src/NanoMusicStore.sol',
    contractName: 'NanoMusicStore',
  },
  {
    name: 'NanoMusicStore Proxy',
    address: '0x86E1D788FFCd8232D85dD7eB02c508e7021EB474',
    sourcePath: '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol',
    contractName: 'ERC1967Proxy',
    constructorArgs: '00000000000000000000000046df1b6aafc71cf6cb231b57b4a51996ddb11bb6000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000641794bb3c0000000000000000000000003a364f43893c86553574bf28bcb4a3d7ff0c7c1f0000000000000000000000004f2cbdde7dc571e31b2bfe013ba0e2db50f22ead0000000000000000000000000000000000000000000000000000000001e8480000000000000000000000000000000000000000000000000000000000',
  },
  {
    name: 'NanoAnimalCare Implementation',
    address: '0xDBc508c96aC737C9a856B0C98f5281E16C9c8F35',
    sourcePath: 'src/NanoAnimalCare.sol',
    contractName: 'NanoAnimalCare',
  },
  {
    name: 'NanoAnimalCare Proxy',
    address: '0xAAfD6b707770BC9F60A773405dE194348B6C4392',
    sourcePath: '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol',
    contractName: 'ERC1967Proxy',
    constructorArgs: '000000000000000000000000dbc508c96ac737c9a856b0c98f5281e16c9c8f3500000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000044485cc9550000000000000000000000003a364f43893c86553574bf28bcb4a3d7ff0c7c1f0000000000000000000000004f2cbdde7dc571e31b2bfe013ba0e2db50f22ead00000000000000000000000000000000000000000000000000000000',
  },
];

const API_URL = 'https://api-explorer.sophon.xyz/api';

async function flattenContract(contractPath: string): Promise<string> {
  try {
    console.log(`   Flattening ${contractPath}...`);
    const output = execSync(`forge flatten ${contractPath}`, { encoding: 'utf8' });
    return output;
  } catch (error) {
    console.error(`Error flattening ${contractPath}:`, error);
    throw error;
  }
}

async function verifyContract(contract: ContractInfo) {
  console.log(`\n📋 Verifying ${contract.name}`);
  console.log(`   Address: ${contract.address}`);

  try {
    // Determine the actual source path
    let actualSourcePath: string;
    if (contract.sourcePath.startsWith('@openzeppelin')) {
      actualSourcePath = 'lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol';
    } else {
      actualSourcePath = contract.sourcePath;
    }

    // Flatten the contract
    const sourceCode = await flattenContract(actualSourcePath);

    // Prepare the request body
    const requestBody = {
      address: contract.address,
      sourceCode: sourceCode,
      contractName: contract.contractName,
      compilerVersion: 'v0.8.24+commit.e11b9ed9',
      optimizationUsed: 1,
      runs: 200,
      evmVersion: 'cancun',
      ...(contract.constructorArgs && { constructorArguments: contract.constructorArgs })
    };

    // Send verification request
    console.log('   📤 Sending verification request...');
    const response = await fetch(`${API_URL}/contract/verifysourcecode`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    let result;
    
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error('   ❌ Invalid response:', responseText);
      return;
    }
    
    if (result.status === '1' || result.result) {
      const guid = result.result || result.message;
      console.log(`   ✅ Request submitted!`);
      console.log(`   📝 GUID: ${guid}`);
      
      // Check verification status
      await checkVerificationStatus(guid);
    } else {
      console.error(`   ❌ Failed: ${result.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error}`);
  }
}

async function checkVerificationStatus(guid: string, attempts = 0): Promise<void> {
  if (attempts > 30) {
    console.log('\n   ⏱️  Taking too long. Check manually at:');
    console.log(`      https://explorer.testnet.sophon.xyz/address/${guid}`);
    return;
  }

  try {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const response = await fetch(`${API_URL}/contract/checkverifystatus?guid=${guid}`);
    const responseText = await response.text();
    
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      process.stdout.write('.');
      await checkVerificationStatus(guid, attempts + 1);
      return;
    }

    if (result.status === '1') {
      console.log('\n   ✅ Contract verified successfully!');
    } else if (result.result && (result.result.includes('Pending') || result.result.includes('queue'))) {
      process.stdout.write('.');
      await checkVerificationStatus(guid, attempts + 1);
    } else {
      console.error(`\n   ❌ Verification failed: ${result.result || result.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('\n   ❌ Error checking status:', error);
  }
}

async function testApi() {
  console.log('🧪 Testing Sophon API...\n');
  
  try {
    // Test if API is accessible
    const testResponse = await fetch(`${API_URL}/stats/tokensupply?contractaddress=0x0000000000000000000000000000000000000000`);
    console.log(`API Status: ${testResponse.status} ${testResponse.statusText}`);
    
    // Try a simple verification request to see the response format
    console.log('\n📝 Testing verification endpoint...');
    const testBody = {
      address: '0x0000000000000000000000000000000000000000',
      sourceCode: 'contract Test {}',
      contractName: 'Test',
      compilerVersion: 'v0.8.24+commit.e11b9ed9',
      optimizationUsed: 0,
      runs: 200,
    };
    
    const verifyResponse = await fetch(`${API_URL}/contract/verifysourcecode`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testBody),
    });
    
    const verifyText = await verifyResponse.text();
    console.log('Verification endpoint response:', verifyText);
    
  } catch (error) {
    console.error('API test failed:', error);
  }
}

async function main() {
  console.log('🚀 Sophon Contract Verification Script');
  console.log('=====================================');
  console.log('📍 Network: Sophon Testnet (Chain ID: 531050104)');
  console.log('🌐 API URL: https://api-explorer.sophon.xyz');
  console.log('🔧 Compiler: v0.8.24+commit.e11b9ed9');
  console.log('⚡ Optimization: Enabled (200 runs)');
  console.log('📦 EVM Version: Cancun');
  
  // Optional: Test API first
  const args = process.argv.slice(2);
  if (args.includes('--test')) {
    await testApi();
    console.log('\n');
  }

  // Verify each contract
  for (const contract of CONTRACTS) {
    await verifyContract(contract);
    // Add delay between verifications
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  console.log('\n\n✨ Verification process complete!');
  console.log('📍 Check your contracts at:');
  console.log('   https://explorer.testnet.sophon.xyz\n');
}

// Run the script
main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});