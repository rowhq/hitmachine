// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {TestExt} from "lib/forge-zksync-std/src/TestExt.sol";
import {NanoMusicStore} from "../src/NanoMusicStore.sol";
import {NanoAnimalCare} from "../src/NanoAnimalCare.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

// Deploy with:
// source .env && forge script ./script/Deploy.s.sol --rpc-url $SOPHON_TESTNET_RPC_URL --private-key $WALLET_PRIVATE_KEY --zksync --broadcast --verify --verifier-api-key $ETHERSCAN_SOPHON_API_KEY --verifier-url https://explorer.testnet.sophon.xyz/api
contract DeployScript is Script, TestExt {
    // Configuration
    uint256 constant INITIAL_GIFTCARD_PRICE = 31.96e6; // $31.96 with 6 decimals

    // Sophon Testnet addresses
    address constant SOPHON_TESTNET_PAYMASTER = 0x98546B226dbbA8230cf620635a1e4ab01F6A99B2;

    // Sophon Mainnet addresses
    address constant SOPHON_MAINNET_PAYMASTER = 0x98546B226dbbA8230cf620635a1e4ab01F6A99B2;
    address constant SOPHON_MAINNET_USDC = 0x9Aa0F72392B5784Ad86c6f3E899bCc053D00Db4F;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("WALLET_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Determine network
        uint256 chainId = block.chainid;
        bool isMainnet = chainId == 50104;
        bool isTestnet = chainId == 531050104;

        require(isMainnet || isTestnet, "Unsupported network");

        address paymaster = isMainnet ? SOPHON_MAINNET_PAYMASTER : SOPHON_TESTNET_PAYMASTER;
        address usdcAddress;

        console.log("========================================");
        console.log("Deploying to", isMainnet ? "MAINNET" : "TESTNET");
        console.log("Chain ID:", chainId);
        console.log("Deployer:", deployer);
        console.log("Paymaster:", paymaster);
        console.log("========================================");

        vm.startBroadcast(deployerPrivateKey);

        // Configure paymaster for gasless deployment
        bytes memory paymasterInput = abi.encodeWithSelector(bytes4(keccak256("general(bytes)")), bytes("0x"));
        console.log("Using paymaster for gasless deployment");

        // Deploy MockUSDC on testnet, use real USDC on mainnet
        if (isTestnet) {
            console.log("\n1. Deploying MockUSDC (testnet)...");
            vmExt.zkUsePaymaster(paymaster, paymasterInput);
            MockUSDC mockUsdc = new MockUSDC();
            usdcAddress = address(mockUsdc);
            console.log("   MockUSDC deployed at:", usdcAddress);
            console.log("   Note: Deployer can mint USDC using mintTo() function as owner");
        } else {
            usdcAddress = SOPHON_MAINNET_USDC;
            console.log("\n1. Using mainnet USDC at:", usdcAddress);
        }

        // Deploy NanoMusicStore implementation
        console.log("\n2. Deploying NanoMusicStore implementation...");
        vmExt.zkUsePaymaster(paymaster, paymasterInput);
        NanoMusicStore musicStoreImpl = new NanoMusicStore();
        console.log("   Implementation:", address(musicStoreImpl));

        // Deploy proxy and initialize
        console.log("\n3. Deploying NanoMusicStore proxy...");
        bytes memory initData =
            abi.encodeWithSelector(NanoMusicStore.initialize.selector, usdcAddress, deployer, INITIAL_GIFTCARD_PRICE);
        vmExt.zkUsePaymaster(paymaster, paymasterInput);
        ERC1967Proxy musicStoreProxy = new ERC1967Proxy(address(musicStoreImpl), initData);
        console.log("   Proxy:", address(musicStoreProxy));

        // Deploy NanoAnimalCare implementation
        console.log("\n4. Deploying NanoAnimalCare implementation...");
        vmExt.zkUsePaymaster(paymaster, paymasterInput);
        NanoAnimalCare animalCareImpl = new NanoAnimalCare();
        console.log("   Implementation:", address(animalCareImpl));

        // Deploy proxy and initialize
        console.log("\n5. Deploying NanoAnimalCare proxy...");
        bytes memory animalInitData = abi.encodeWithSelector(NanoAnimalCare.initialize.selector, usdcAddress, deployer);
        vmExt.zkUsePaymaster(paymaster, paymasterInput);

        ERC1967Proxy animalCareProxy = new ERC1967Proxy(address(animalCareImpl), animalInitData);
        console.log("   Proxy:", address(animalCareProxy));

        vm.stopBroadcast();

        // Print deployment summary
        console.log("\n========================================");
        console.log("DEPLOYMENT COMPLETE!");
        console.log("========================================");
        console.log("\nDeployed Contracts:");
        console.log("-------------------");
        if (isTestnet) {
            console.log("MockUSDC:", usdcAddress);
        }
        console.log("NanoMusicStore:");
        console.log("  Implementation:", address(musicStoreImpl));
        console.log("  Proxy:", address(musicStoreProxy));
        console.log("\nNanoAnimalCare:");
        console.log("  Implementation:", address(animalCareImpl));
        console.log("  Proxy:", address(animalCareProxy));

        console.log("\n========================================");
        console.log("Next Steps:");
        console.log("1. Verify contracts on Sophscan");
        console.log("2. Grant necessary roles to operators");
        console.log("3. Update frontend with new addresses");
        if (isTestnet) {
            console.log(
                "4. Mint test USDC: cast send <MockUSDC_ADDRESS> 'mintTo(address,uint256)' <RECIPIENT> <AMOUNT>"
            );
        }
        console.log("========================================");

        console.log("\n========================================");
        console.log("DEPLOYMENT COMMANDS:");
        console.log("========================================");
        console.log("\nFor Sophon Testnet:");
        console.log("source .env && forge script ./script/Deploy.s.sol \\");
        console.log("  --rpc-url $SOPHON_TESTNET_RPC_URL \\");
        console.log("  --private-key $WALLET_PRIVATE_KEY \\");
        console.log("  --zksync \\");
        console.log("  --broadcast \\");
        console.log("  --verify \\");
        console.log("  --verifier-api-key $ETHERSCAN_SOPHON_API_KEY \\");
        console.log("  --verifier-url https://explorer.testnet.sophon.xyz/api");
        console.log("\nFor Sophon Mainnet:");
        console.log("source .env && forge script ./script/Deploy.s.sol \\");
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
