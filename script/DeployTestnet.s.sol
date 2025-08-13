// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {StoreV2} from "../src/StoreV2.sol";
import {JobsV2} from "../src/JobsV2.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {TestExt} from "../lib/forge-zksync-std/src/TestExt.sol";

contract DeployTestnetScript is Script, TestExt {
    uint256 constant INITIAL_GIFTCARD_PRICE = 32e6; // 32 USDC with 6 decimals
    address constant TESTNET_PAYMASTER = 0x98546B226dbbA8230cf620635a1e4ab01F6A99B2;

    function run() external returns (address storeProxy, address jobsProxy, address mockUSDC) {
        // Get configuration from environment
        uint256 deployerPrivateKey = vm.envUint("WALLET_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        address usdcAddress;

        vm.startBroadcast(deployerPrivateKey);

        // Setup paymaster for gasless transactions
        bytes memory paymasterInput = abi.encodeWithSelector(bytes4(keccak256("general(bytes)")), bytes("0x"));
        vmExt.zkUsePaymaster(TESTNET_PAYMASTER, paymasterInput);

        // Deploy mock USDC for testnet
        console.log("Deploying MockUSDC...");

        MockUSDC _mockUSDC = new MockUSDC();
        usdcAddress = address(_mockUSDC);
        console.log("MockUSDC deployed at:", usdcAddress);

        // Mint initial tokens to deployer for testing
        _mockUSDC.mintTo(deployer, 10000 * 10 ** 6); // 10,000 USDC
        console.log("Minted 10,000 USDC to deployer");

        console.log("Deploying Store contract with:");
        console.log("  Deployer:", deployer);
        console.log("  USDC:", usdcAddress);
        console.log("  Paymaster:", TESTNET_PAYMASTER);

        // Deploy Store implementation
        StoreV2 storeImpl = new StoreV2();
        console.log("Store implementation deployed at:", address(storeImpl));

        // Deploy Store proxy
        bytes memory storeInitData =
            abi.encodeWithSelector(StoreV2.initialize.selector, usdcAddress, deployer, INITIAL_GIFTCARD_PRICE);
        ERC1967Proxy _storeProxy = new ERC1967Proxy(address(storeImpl), storeInitData);
        console.log("Store proxy deployed at:", address(_storeProxy));

        // Deploy Jobs implementation
        JobsV2 jobsImpl = new JobsV2();
        console.log("Jobs implementation deployed at:", address(jobsImpl));

        // Deploy Jobs proxy
        bytes memory jobsInitData =
            abi.encodeWithSelector(JobsV2.initialize.selector, usdcAddress, deployer);
        ERC1967Proxy _jobsProxy = new ERC1967Proxy(address(jobsImpl), jobsInitData);
        console.log("Jobs proxy deployed at:", address(_jobsProxy));

        // Fund Jobs contract with initial USDC for cat feeding
        _mockUSDC.mintTo(address(_jobsProxy), 10000 * 10 ** 6); // 10,000 USDC
        console.log("Minted 10,000 USDC to Jobs contract");

        vm.stopBroadcast();

        // Output deployment summary
        console.log("\n========================================");
        console.log("TESTNET DEPLOYMENT COMPLETE");
        console.log("========================================");
        console.log("Network: Sophon Testnet");
        console.log("USDC Address:", usdcAddress);
        console.log("Store Proxy:", address(_storeProxy));
        console.log("Store Implementation:", address(storeImpl));
        console.log("Jobs Proxy:", address(_jobsProxy));
        console.log("Jobs Implementation:", address(jobsImpl));
        console.log("Admin:", deployer);
        console.log("Initial Gift Card Price: 32 USDC");
        console.log("========================================");
        console.log("\nFrontend configuration:");
        console.log("[SUCCESS] Auto-updated frontend/.env.local with:");
        console.log("  NEXT_PUBLIC_STORE_CONTRACT=", address(_storeProxy));
        console.log("  NEXT_PUBLIC_JOBS_CONTRACT=", address(_jobsProxy));
        console.log("  NEXT_PUBLIC_USDC_ADDRESS=", usdcAddress);
        console.log("========================================");

        // Save deployment info to file
        string memory deploymentInfo = string.concat(
            "# Sophon Testnet Deployment\n",
            "STORE_PROXY=",
            vm.toString(address(_storeProxy)),
            "\n",
            "STORE_IMPL=",
            vm.toString(address(storeImpl)),
            "\n",
            "JOBS_PROXY=",
            vm.toString(address(_jobsProxy)),
            "\n",
            "JOBS_IMPL=",
            vm.toString(address(jobsImpl)),
            "\n",
            "USDC_ADDRESS=",
            vm.toString(usdcAddress),
            "\n",
            "ADMIN=",
            vm.toString(deployer),
            "\n"
        );
        vm.writeFile("deployed-addresses-testnet.txt", deploymentInfo);
        
        // Write frontend env file
        string memory frontendEnv = string.concat(
            "# Auto-generated from DeployTestnet.s.sol\n",
            "NEXT_PUBLIC_STORE_CONTRACT=",
            vm.toString(address(_storeProxy)),
            "\n",
            "NEXT_PUBLIC_JOBS_CONTRACT=",
            vm.toString(address(_jobsProxy)),
            "\n",
            "NEXT_PUBLIC_USDC_ADDRESS=",
            vm.toString(usdcAddress),
            "\n",
            "NEXT_PUBLIC_NETWORK=testnet\n"
        );
        vm.writeFile("frontend/.env.local", frontendEnv);

        return (address(_storeProxy), address(_jobsProxy), usdcAddress);
    }
}
