// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {TestExt} from "lib/forge-zksync-std/src/TestExt.sol";
import {NanoMusicStore} from "../src/NanoMusicStore.sol";
import {NanoBand} from "../src/NanoBand.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

// Deploy to Sophon Testnet with:
// source .env && forge script ./script/DeployTestnet.s.sol --rpc-url $SOPHON_TESTNET_RPC_URL --private-key $WALLET_PRIVATE_KEY --zksync --broadcast --verify --verifier-api-key $ETHERSCAN_SOPHON_API_KEY --verifier-url https://explorer.testnet.sophon.xyz/api
contract DeployTestnetScript is Script, TestExt {
    // Configuration
    uint256 constant INITIAL_GIFTCARD_PRICE = 31.96e6; // $31.96 with 6 decimals

    // Sophon Testnet config
    uint256 constant SOPHON_TESTNET_CHAIN_ID = 531050104;

    function run() external {
        // Get wallet2 mnemonic and w2 private key from .env
        string memory wallet2Mnemonic = vm.envString("wallet2");
        uint256 deployerPrivateKey = vm.envUint("w2");
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
        console.log("Deployer (Nano Wallet - Index 0):", deployer);
        console.log("Deployer Balance:", deployer.balance, "wei");
        console.log("========================================");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy MockUSDC (testnet only)
        console.log("\n1. Deploying MockUSDC...");
        MockUSDC mockUsdc = new MockUSDC();
        address usdcAddress = address(mockUsdc);
        console.log("   MockUSDC deployed at:", usdcAddress);
        console.log("   Note: Deployer can mint USDC using mintTo() function as owner");

        // Deploy NanoMusicStore implementation
        console.log("\n2. Deploying NanoMusicStore implementation...");
        NanoMusicStore musicStoreImpl = new NanoMusicStore();
        console.log("   Implementation:", address(musicStoreImpl));

        // Deploy proxy and initialize
        console.log("\n3. Deploying NanoMusicStore proxy...");
        bytes memory initData =
            abi.encodeWithSelector(NanoMusicStore.initialize.selector, usdcAddress, deployer, INITIAL_GIFTCARD_PRICE);
        ERC1967Proxy musicStoreProxy = new ERC1967Proxy(address(musicStoreImpl), initData);
        console.log("   Proxy:", address(musicStoreProxy));

        // Deploy NanoBand implementation
        console.log("\n4. Deploying NanoBand implementation...");
        NanoBand nanoBandImpl = new NanoBand();
        console.log("   Implementation:", address(nanoBandImpl));

        // Deploy proxy and initialize
        console.log("\n5. Deploying NanoBand proxy...");
        bytes memory bandInitData = abi.encodeWithSelector(NanoBand.initialize.selector, usdcAddress, deployer);
        ERC1967Proxy nanoBandProxy = new ERC1967Proxy(address(nanoBandImpl), bandInitData);
        console.log("   Proxy:", address(nanoBandProxy));

        // Grant roles
        console.log("\n6. Granting roles...");

        // Derive admin addresses from wallet2 mnemonic (shifted indices)
        address bandAdmin = vm.addr(vm.deriveKey(wallet2Mnemonic, uint32(2)));
        address storeAdmin = vm.addr(vm.deriveKey(wallet2Mnemonic, uint32(3)));
        address marketingAdmin = vm.addr(vm.deriveKey(wallet2Mnemonic, uint32(4)));

        console.log("   Index 0 (Deployer/Nano):", deployer);
        console.log("   Index 2 (Band Admin):", bandAdmin);
        console.log("   Index 3 (Store Admin):", storeAdmin);
        console.log("   Index 4 (Marketing):", marketingAdmin);

        // Get contract instances
        NanoMusicStore musicStore = NanoMusicStore(address(musicStoreProxy));
        NanoBand band = NanoBand(address(nanoBandProxy));

        // Grant ADMIN_ROLE to bandAdmin on Band
        band.grantRole(band.ADMIN_ROLE(), bandAdmin);
        console.log("   [DONE] Granted ADMIN_ROLE to Index 2 on Band");

        // Grant ADMIN_ROLE to storeAdmin on Store
        musicStore.grantRole(musicStore.ADMIN_ROLE(), storeAdmin);
        console.log("   [DONE] Granted ADMIN_ROLE to Index 3 on Store");

        // Grant MARKETING_BUDGET_ROLE to marketingAdmin on Store
        musicStore.grantRole(musicStore.MARKETING_BUDGET_ROLE(), marketingAdmin);
        console.log("   [DONE] Granted MARKETING_BUDGET_ROLE to Index 4 on Store");

        // Grant DISTRIBUTOR_ROLE to 100 addresses (indices 100-199) on Band
        console.log("   Granting DISTRIBUTOR_ROLE to 100 addresses (indices 100-199)...");
        for (uint32 i = 100; i < 200; i++) {
            address distributor = vm.addr(vm.deriveKey(wallet2Mnemonic, i));
            band.grantRole(band.DISTRIBUTOR_ROLE(), distributor);
            if (i == 199) {
                console.log("   [DONE] Granted DISTRIBUTOR_ROLE to 100 addresses");
            }
        }

        vm.stopBroadcast();

        // Print deployment summary
        console.log("\n========================================");
        console.log("TESTNET DEPLOYMENT COMPLETE!");
        console.log("========================================");
        console.log("\nDeployed Contracts:");
        console.log("-------------------");
        console.log("MockUSDC:", usdcAddress);
        console.log("NanoMusicStore:");
        console.log("  Implementation:", address(musicStoreImpl));
        console.log("  Proxy:", address(musicStoreProxy));
        console.log("NanoBand:");
        console.log("  Implementation:", address(nanoBandImpl));
        console.log("  Proxy:", address(nanoBandProxy));

        console.log("\n========================================");
        console.log("Next Steps:");
        console.log("========================================");
        console.log("1. [DONE] Contracts deployed");
        console.log("2. [DONE] Roles granted");
        console.log("3. Verify contracts on Sophscan");
        console.log("4. Update frontend config with new addresses");
        console.log(
            "5. Mint test USDC: cast send", vm.toString(usdcAddress), "'mintTo(address,uint256)' <RECIPIENT> <AMOUNT>"
        );
        console.log("========================================");
    }
}
