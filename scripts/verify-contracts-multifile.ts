#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

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
    address: '0x3a364f43893C86553574bf28Bcb4a3d7ff0c7c1f',
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

const API_KEY = process.env.ETHERSCAN_SOPHON_API_KEY;
const API_URL = 'https://api-explorer.sophon.xyz/api';

async function verifyContract(contract: ContractInfo) {
  console.log(`\n📋 Verifying ${contract.name} at ${contract.address}...`);

  try {
    // Prepare the form data
    const formData = new FormData();
    formData.append('apikey', API_KEY!);
    formData.append('module', 'contract');
    formData.append('action', 'verifysourcecode');
    formData.append('address', contract.address);
    formData.append('contractname', contract.contractName);
    formData.append('compilerversion', 'v0.8.24+commit.e11b9ed9');
    formData.append('optimizationUsed', '1');
    formData.append('runs', '200');
    formData.append('evmversion', 'cancun');
    
    if (contract.constructorArgs) {
      formData.append('constructorArguements', contract.constructorArgs); // Note: API expects "Arguements" (typo)
    }

    // Read source files
    const sourceFiles: Record<string, { content: string }> = {};
    
    // For proxy contracts, we need to include OpenZeppelin files
    if (contract.sourcePath.includes('@openzeppelin')) {
      // Read proxy contract
      const proxyPath = path.join('lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol');
      sourceFiles['@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol'] = {
        content: fs.readFileSync(proxyPath, 'utf8')
      };
      
      // Read dependencies
      const deps = [
        '@openzeppelin/contracts/proxy/Proxy.sol',
        '@openzeppelin/contracts/proxy/ERC1967/ERC1967Utils.sol',
        '@openzeppelin/contracts/proxy/beacon/IBeacon.sol',
        '@openzeppelin/contracts/utils/Address.sol',
        '@openzeppelin/contracts/utils/StorageSlot.sol',
        '@openzeppelin/contracts/interfaces/IERC1967.sol'
      ];
      
      for (const dep of deps) {
        const depPath = path.join('lib/openzeppelin-contracts', dep.replace('@openzeppelin/', ''));
        if (fs.existsSync(depPath)) {
          sourceFiles[dep] = { content: fs.readFileSync(depPath, 'utf8') };
        }
      }
    } else {
      // Read main contract
      sourceFiles[contract.sourcePath] = {
        content: fs.readFileSync(contract.sourcePath, 'utf8')
      };
      
      // Check for imports and add them
      if (contract.name.includes('Nano')) {
        // Add OpenZeppelin upgradeable contracts
        const upgradeableDeps = [
          '@openzeppelin-upgradeable/contracts/proxy/utils/Initializable.sol',
          '@openzeppelin-upgradeable/contracts/access/OwnableUpgradeable.sol',
          '@openzeppelin-upgradeable/contracts/utils/PausableUpgradeable.sol',
          '@openzeppelin-upgradeable/contracts/utils/ReentrancyGuardUpgradeable.sol',
          '@openzeppelin-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol',
          '@openzeppelin-upgradeable/contracts/access/AccessControlUpgradeable.sol',
          '@openzeppelin-upgradeable/contracts/utils/ContextUpgradeable.sol',
          '@openzeppelin-upgradeable/contracts/utils/introspection/ERC165Upgradeable.sol',
          '@openzeppelin-upgradeable/contracts/interfaces/IERC165Upgradeable.sol',
          '@openzeppelin-upgradeable/contracts/proxy/ERC1967/ERC1967Utils.sol',
          '@openzeppelin-upgradeable/contracts/utils/Address.sol',
          '@openzeppelin-upgradeable/contracts/utils/StorageSlot.sol',
          '@openzeppelin-upgradeable/contracts/interfaces/IERC1967.sol',
          '@openzeppelin-upgradeable/contracts/proxy/beacon/IBeacon.sol',
          '@openzeppelin-upgradeable/contracts/interfaces/draft-IERC1822.sol',
          '@openzeppelin-upgradeable/contracts/utils/introspection/IERC165.sol'
        ];
        
        for (const dep of upgradeableDeps) {
          const depPath = path.join('lib/openzeppelin-contracts-upgradeable', dep.replace('@openzeppelin-upgradeable/', ''));
          if (fs.existsSync(depPath)) {
            sourceFiles[dep] = { content: fs.readFileSync(depPath, 'utf8') };
          }
        }
      }
      
      // Add IERC20
      sourceFiles['@openzeppelin/contracts/token/ERC20/IERC20.sol'] = {
        content: fs.readFileSync('lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol', 'utf8')
      };
      
      // For MockUSDC, add ERC20 implementation
      if (contract.name === 'MockUSDC') {
        const erc20Deps = [
          '@openzeppelin/contracts/token/ERC20/ERC20.sol',
          '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol',
          '@openzeppelin/contracts/utils/Context.sol',
          '@openzeppelin/contracts/interfaces/draft-IERC6093.sol'
        ];
        
        for (const dep of erc20Deps) {
          const depPath = path.join('lib/openzeppelin-contracts', dep.replace('@openzeppelin/', ''));
          if (fs.existsSync(depPath)) {
            sourceFiles[dep] = { content: fs.readFileSync(depPath, 'utf8') };
          }
        }
      }
    }

    // Convert to JSON and append
    formData.append('sourceCode', JSON.stringify({ sources: sourceFiles }));
    formData.append('codeformat', 'solidity-standard-json-input');

    // Send verification request
    console.log('📤 Sending verification request...');
    const response = await fetch(`${API_URL}/contract/verifysourcecode`, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();
    
    if (result.status === '1') {
      console.log(`✅ Verification request submitted!`);
      console.log(`   GUID: ${result.result}`);
      
      // Check status
      await checkVerificationStatus(result.result);
    } else {
      console.error(`❌ Failed: ${result.message || result.result}`);
    }
  } catch (error) {
    console.error(`❌ Error: ${error}`);
  }
}

async function checkVerificationStatus(guid: string, attempts = 0): Promise<void> {
  if (attempts > 30) {
    console.log('\n⏱️  Taking too long. Check manually at:');
    console.log(`   https://explorer.testnet.sophon.xyz/api/contract/checkverifystatus?guid=${guid}`);
    return;
  }

  try {
    const response = await fetch(`${API_URL}/contract/checkverifystatus?guid=${guid}&apikey=${API_KEY}`);
    const result = await response.json();

    if (result.status === '1') {
      console.log('\n✅ Contract verified successfully!');
    } else if (result.result.includes('Pending') || result.result.includes('queue')) {
      process.stdout.write('.');
      await new Promise(resolve => setTimeout(resolve, 2000));
      await checkVerificationStatus(guid, attempts + 1);
    } else {
      console.error(`\n❌ Verification failed: ${result.result}`);
    }
  } catch (error) {
    console.error('\n❌ Error checking status:', error);
  }
}

async function main() {
  console.log('🚀 Sophon Contract Verification (Multi-file)');
  console.log('===========================================');

  if (!API_KEY || API_KEY === 'YOUR_SOPHSCAN_API_KEY_HERE') {
    console.error('\n❌ ETHERSCAN_SOPHON_API_KEY not set in .env');
    console.error('   Get your API key from:');
    console.error('   https://explorer.testnet.sophon.xyz\n');
    process.exit(1);
  }

  console.log(`\n📍 Network: Sophon Testnet`);
  console.log(`🔧 Compiler: v0.8.24+commit.e11b9ed9`);
  console.log(`⚡ Optimization: Enabled (200 runs)`);
  console.log(`📦 EVM Version: Cancun`);

  // Process each contract
  for (const contract of CONTRACTS) {
    await verifyContract(contract);
    // Delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  console.log('\n\n✨ All done! Check verification status at:');
  console.log('   https://explorer.testnet.sophon.xyz');
}

// Run it
main().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});