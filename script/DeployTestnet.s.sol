// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {TestExt} from "lib/forge-zksync-std/src/TestExt.sol";
import {NanoMusicStore} from "../src/NanoMusicStore.sol";
import {NanoBand} from "../src/NanoBand.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

// Deploy to Sophon Testnet with:
// source .env && forge script ./script/DeployTestnet.s.sol --rpc-url https://rpc.testnet.sophon.xyz --zksync --broadcast
contract DeployTestnetScript is Script, TestExt {
    // Configuration
    uint256 constant INITIAL_GIFTCARD_PRICE = 31.96e6; // $31.96 with 6 decimals

    // Sophon Testnet config
    address constant SOPHON_TESTNET_PAYMASTER = 0x98546B226dbbA8230cf620635a1e4ab01F6A99B2;
    uint256 constant SOPHON_TESTNET_CHAIN_ID = 531050104;

    function run() external {
        // Get PROD_WALLET mnemonic for deployer and role assignments
        string memory PROD_WALLETMnemonic = vm.envString("PROD_WALLET");

        // Derive deployer private key from PROD_WALLET at index 0
        uint256 deployerPrivateKey = vm.deriveKey(PROD_WALLETMnemonic, uint32(0));
        address deployer = vm.addr(deployerPrivateKey);

        // Verify we're on testnet
        uint256 chainId = block.chainid;
        require(
            chainId == SOPHON_TESTNET_CHAIN_ID,
            "ERROR: This script is for TESTNET only! Use DeployMainnet.s.sol for mainnet."
        );

        console.log("========================================");
        console.log("TESTNET DEPLOYMENT");
        console.log("========================================");
        console.log("Chain ID:", chainId);
        console.log("Deployer (PROD_WALLET index 0):", deployer);
        console.log("Deployer Balance:", deployer.balance, "wei");
        console.log("========================================");

        vm.startBroadcast(deployerPrivateKey);

        // Configure paymaster for contract deployments
        bytes memory paymasterInput = abi.encodeWithSelector(bytes4(keccak256("general(bytes)")), bytes("0x"));

        // Deploy MockUSDC on testnet
        console.log("\n1. Deploying MockUSDC (testnet)...");
        vmExt.zkUsePaymaster(SOPHON_TESTNET_PAYMASTER, paymasterInput);
        MockUSDC mockUsdc = new MockUSDC();
        address usdcAddress = address(mockUsdc);
        console.log("   MockUSDC deployed at:", usdcAddress);
        console.log("   Note: Deployer can mint USDC using mintTo() function as owner");

        // Deploy NanoMusicStore implementation
        console.log("\n2. Deploying NanoMusicStore implementation...");
        vmExt.zkUsePaymaster(SOPHON_TESTNET_PAYMASTER, paymasterInput);
        NanoMusicStore musicStoreImpl = new NanoMusicStore();
        console.log("   Implementation:", address(musicStoreImpl));

        // Deploy NanoMusicStore proxy with initialization
        console.log("\n3. Deploying NanoMusicStore proxy...");
        bytes memory initData = abi.encodeWithSelector(
            NanoMusicStore.initialize.selector, usdcAddress, deployer, INITIAL_GIFTCARD_PRICE
        );
        vmExt.zkUsePaymaster(SOPHON_TESTNET_PAYMASTER, paymasterInput);
        ERC1967Proxy musicStoreProxy = new ERC1967Proxy(address(musicStoreImpl), initData);
        console.log("   Proxy:", address(musicStoreProxy));

        // Deploy NanoBand implementation
        console.log("\n4. Deploying NanoBand implementation...");
        vmExt.zkUsePaymaster(SOPHON_TESTNET_PAYMASTER, paymasterInput);
        NanoBand nanoBandImpl = new NanoBand();
        console.log("   Implementation:", address(nanoBandImpl));

        // Deploy NanoBand proxy with initialization
        console.log("\n5. Deploying NanoBand proxy...");
        bytes memory bandInitData = abi.encodeWithSelector(NanoBand.initialize.selector, usdcAddress, deployer);
        vmExt.zkUsePaymaster(SOPHON_TESTNET_PAYMASTER, paymasterInput);
        ERC1967Proxy nanoBandProxy = new ERC1967Proxy(address(nanoBandImpl), bandInitData);
        console.log("   Proxy:", address(nanoBandProxy));

        // Get contract instances for role granting
        NanoMusicStore musicStore = NanoMusicStore(address(musicStoreProxy));
        NanoBand band = NanoBand(address(nanoBandProxy));

        console.log("\n========================================");
        console.log("GRANTING ROLES");
        console.log("========================================");

        // Derive admin addresses from PROD_WALLET mnemonic
        address bandAdmin = vm.addr(vm.deriveKey(PROD_WALLETMnemonic, uint32(2)));
        address storeAdmin = vm.addr(vm.deriveKey(PROD_WALLETMnemonic, uint32(3)));
        address marketingAdmin = vm.addr(vm.deriveKey(PROD_WALLETMnemonic, uint32(4)));

        console.log("\nAdmin Addresses (derived from PROD_WALLET mnemonic):");
        console.log("-------------------");
        console.log("Index 2 (Band Admin):", bandAdmin);
        console.log("Index 3 (Store Admin):", storeAdmin);
        console.log("Index 4 (Marketing):", marketingAdmin);
        console.log("Indices 100-199 (100 Distributors): will be granted DISTRIBUTOR_ROLE");

        // Grant ADMIN_ROLE to bandAdmin on Band
        console.log("\n6. Granting ADMIN_ROLE to Index 2 on Band...");
        band.grantRole(band.ADMIN_ROLE(), bandAdmin);
        console.log("   [DONE] ADMIN_ROLE granted");

        // Grant ADMIN_ROLE to storeAdmin on Store
        console.log("\n7. Granting ADMIN_ROLE to Index 3 on Store...");
        musicStore.grantRole(musicStore.ADMIN_ROLE(), storeAdmin);
        console.log("   [DONE] ADMIN_ROLE granted");

        // Grant MARKETING_BUDGET_ROLE to marketingAdmin on Store
        console.log("\n8. Granting MARKETING_BUDGET_ROLE to Index 4 on Store...");
        musicStore.grantRole(musicStore.MARKETING_BUDGET_ROLE(), marketingAdmin);
        console.log("   [DONE] MARKETING_BUDGET_ROLE granted");

        // Grant DISTRIBUTOR_ROLE to 100 addresses (indices 100-199)
        console.log("\n9. Granting DISTRIBUTOR_ROLE to 100 addresses (indices 100-199)...");
        for (uint32 i = 100; i < 200; i++) {
            address distributor = vm.addr(vm.deriveKey(PROD_WALLETMnemonic, i));
            band.grantRole(band.DISTRIBUTOR_ROLE(), distributor);
        }
        console.log("   [DONE] DISTRIBUTOR_ROLE granted to all 100 addresses");

        vm.stopBroadcast();

        // Print deployment summary
        console.log("\n========================================");
        console.log("TESTNET DEPLOYMENT & ROLE GRANTING COMPLETE!");
        console.log("========================================");
        console.log("\nDeployed Contracts:");
        console.log("-------------------");
        console.log("MockUSDC (testnet):", usdcAddress);
        console.log("NanoMusicStore:");
        console.log("  Implementation:", address(musicStoreImpl));
        console.log("  Proxy:", address(musicStoreProxy));
        console.log("NanoBand:");
        console.log("  Implementation:", address(nanoBandImpl));
        console.log("  Proxy:", address(nanoBandProxy));

        console.log("\nRoles Granted:");
        console.log("-------------------");
        console.log("- ADMIN_ROLE on Band -> Index 2");
        console.log("- ADMIN_ROLE on Store -> Index 3");
        console.log("- MARKETING_BUDGET_ROLE on Store -> Index 4");
        console.log("- DISTRIBUTOR_ROLE on Band -> Indices 100-199 (100 addresses)");

        console.log("\n========================================");
        console.log("NEXT STEPS:");
        console.log("========================================");
        console.log("1. Verify contracts on explorer");
        console.log("2. Update frontend config with addresses");
        console.log("3. Mint test USDC: cast send", usdcAddress, "'mintTo(address,uint256)' <RECIPIENT> <AMOUNT>");
        console.log("4. Fund NanoBand contract with USDC");
        console.log("========================================");
    }
}
