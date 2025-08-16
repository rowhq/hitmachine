// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {TestExt} from "lib/forge-zksync-std/src/TestExt.sol";
import {NanoMusicStore} from "../src/NanoMusicStore.sol";
import {NanoAnimalCare} from "../src/NanoAnimalCare.sol";
import {ERC1967Utils} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Utils.sol";

// Upgrade with:
// source .env && forge script ./script/Upgrade.s.sol --rpc-url $SOPHON_TESTNET_RPC_URL --private-key $WALLET_PRIVATE_KEY --zksync --broadcast --verify --verifier-api-key $ETHERSCAN_SOPHON_API_KEY --verifier-url https://explorer.testnet.sophon.xyz/api
contract UpgradeScript is Script, TestExt {
    // Sophon Testnet addresses
    address constant SOPHON_TESTNET_PAYMASTER = 0x98546B226dbbA8230cf620635a1e4ab01F6A99B2;

    // Sophon Mainnet addresses
    address constant SOPHON_MAINNET_PAYMASTER = 0x98546B226dbbA8230cf620635a1e4ab01F6A99B2;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("WALLET_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Get proxy addresses from environment variables
        address musicStoreProxy = vm.envAddress("MUSIC_STORE_PROXY");
        address animalCareProxy = vm.envAddress("ANIMAL_CARE_PROXY");

        // Determine network
        uint256 chainId = block.chainid;
        bool isMainnet = chainId == 50104;
        bool isTestnet = chainId == 531050104;

        require(isMainnet || isTestnet, "Unsupported network");

        address paymaster = isMainnet ? SOPHON_MAINNET_PAYMASTER : SOPHON_TESTNET_PAYMASTER;

        console.log("========================================");
        console.log("Upgrading contracts on", isMainnet ? "MAINNET" : "TESTNET");
        console.log("Chain ID:", chainId);
        console.log("Deployer:", deployer);
        console.log("Paymaster:", paymaster);
        console.log("========================================");
        console.log("\nProxy Addresses:");
        console.log("NanoMusicStore Proxy:", musicStoreProxy);
        console.log("NanoAnimalCare Proxy:", animalCareProxy);
        console.log("========================================");

        vm.startBroadcast(deployerPrivateKey);

        // Configure paymaster for gasless deployment
        bytes memory paymasterInput = abi.encodeWithSelector(bytes4(keccak256("general(bytes)")), bytes("0x"));

        // Get current implementations
        address currentMusicStoreImpl = ERC1967Utils.getImplementation();
        address currentAnimalCareImpl = ERC1967Utils.getImplementation();

        console.log("\nCurrent Implementations:");
        console.log("NanoMusicStore:", currentMusicStoreImpl);
        console.log("NanoAnimalCare:", currentAnimalCareImpl);

        // Deploy new NanoMusicStore implementation
        console.log("\n1. Deploying new NanoMusicStore implementation...");
        vmExt.zkUsePaymaster(paymaster, paymasterInput);
        NanoMusicStore newMusicStoreImpl = new NanoMusicStore();
        console.log("   New Implementation:", address(newMusicStoreImpl));

        // Deploy new NanoAnimalCare implementation
        console.log("\n2. Deploying new NanoAnimalCare implementation...");
        vmExt.zkUsePaymaster(paymaster, paymasterInput);
        NanoAnimalCare newAnimalCareImpl = new NanoAnimalCare();
        console.log("   New Implementation:", address(newAnimalCareImpl));

        // Upgrade NanoMusicStore
        console.log("\n3. Upgrading NanoMusicStore...");
        NanoMusicStore musicStore = NanoMusicStore(musicStoreProxy);
        vmExt.zkUsePaymaster(paymaster, paymasterInput);
        musicStore.upgradeToAndCall(address(newMusicStoreImpl), "");
        console.log("   NanoMusicStore upgraded successfully");

        // Upgrade NanoAnimalCare
        console.log("\n4. Upgrading NanoAnimalCare...");
        NanoAnimalCare animalCare = NanoAnimalCare(animalCareProxy);
        vmExt.zkUsePaymaster(paymaster, paymasterInput);
        animalCare.upgradeToAndCall(address(newAnimalCareImpl), "");
        console.log("    NanoAnimalCare upgraded successfully");

        vm.stopBroadcast();

        // Verify upgrades
        console.log("\n========================================");
        console.log("UPGRADE COMPLETE!");
        console.log("========================================");
        console.log("\nNew Implementations:");
        console.log("NanoMusicStore:", address(newMusicStoreImpl));
        console.log("NanoAnimalCare:", address(newAnimalCareImpl));

        console.log("\n========================================");
        console.log("Next Steps:");
        console.log("1. Verify new implementation contracts on Sophscan");
        console.log("2. Test upgraded functionality");
        console.log("3. Monitor for any issues");
        console.log("========================================");

        console.log("\n========================================");
        console.log("UPGRADE COMMANDS:");
        console.log("========================================");
        console.log("\nFor Sophon Testnet:");
        console.log("export MUSIC_STORE_PROXY=<YOUR_MUSIC_STORE_PROXY_ADDRESS>");
        console.log("export ANIMAL_CARE_PROXY=<YOUR_ANIMAL_CARE_PROXY_ADDRESS>");
        console.log("source .env && forge script ./script/Upgrade.s.sol \\");
        console.log("  --rpc-url $SOPHON_TESTNET_RPC_URL \\");
        console.log("  --private-key $WALLET_PRIVATE_KEY \\");
        console.log("  --zksync \\");
        console.log("  --broadcast \\");
        console.log("  --verify \\");
        console.log("  --verifier-api-key $ETHERSCAN_SOPHON_API_KEY \\");
        console.log("  --verifier-url https://explorer.testnet.sophon.xyz/api");
        console.log("\nFor Sophon Mainnet:");
        console.log("export MUSIC_STORE_PROXY=<YOUR_MUSIC_STORE_PROXY_ADDRESS>");
        console.log("export ANIMAL_CARE_PROXY=<YOUR_ANIMAL_CARE_PROXY_ADDRESS>");
        console.log("source .env && forge script ./script/Upgrade.s.sol \\");
        console.log("  --rpc-url $SOPHON_MAINNET_RPC_URL \\");
        console.log("  --private-key $WALLET_PRIVATE_KEY \\");
        console.log("  --zksync \\");
        console.log("  --broadcast \\");
        console.log("  --verify \\");
        console.log("  --verifier-api-key $ETHERSCAN_SOPHON_API_KEY \\");
        console.log("  --verifier-url https://explorer.sophon.xyz/api");
        console.log("========================================");
    }
}
