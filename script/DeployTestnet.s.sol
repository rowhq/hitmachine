// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {StoreV2} from "../src/StoreV2.sol";
import {JobsV2} from "../src/JobsV2.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {MockSOPH} from "../src/MockSOPH.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {TestExt} from "../lib/forge-zksync-std/src/TestExt.sol";

contract DeployTestnetScript is Script, TestExt {
    uint256 constant INITIAL_ALBUM_PRICE = 10_000; // 0.01 USDC with 6 decimals
    
    // Sophon Testnet addresses
    address constant TESTNET_USDC = 0x9Aa0F72392B5784Ad86c6f3E899bCc053D00Db4F;
    address constant TESTNET_SOPH = 0x5021c14Ff6001E9b889E788a9136f14200fCa364;
    address constant TESTNET_PAYMASTER = 0x98546B226dbbA8230cf620635a1e4ab01F6A99B2;

    function run() external returns (address storeProxy, address jobsProxy, address mockUSDC, address mockSOPH) {
        // Get configuration from environment
        uint256 deployerPrivateKey = vm.envUint("WALLET_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Check if we should deploy mocks or use existing addresses
        bool deployMocks = vm.envOr("DEPLOY_MOCKS", true);
        address usdcAddress;
        address sophAddress;

        vm.startBroadcast(deployerPrivateKey);

        // Setup paymaster for gasless transactions
        bytes memory paymasterInput = abi.encodeWithSelector(
            bytes4(keccak256("general(bytes)")),
            bytes("0x")
        );
        vmExt.zkUsePaymaster(TESTNET_PAYMASTER, paymasterInput);

        // Deploy mock tokens if needed
        if (deployMocks) {
            console.log("Deploying mock tokens...");
            
            MockUSDC _mockUSDC = new MockUSDC();
            usdcAddress = address(_mockUSDC);
            console.log("MockUSDC deployed at:", usdcAddress);
            
            MockSOPH _mockSOPH = new MockSOPH();
            sophAddress = address(_mockSOPH);
            console.log("MockSOPH deployed at:", sophAddress);
            
            // Mint initial tokens to deployer for testing
            _mockUSDC.mintTo(deployer, 10000 * 10 ** 6); // 10,000 USDC
            _mockSOPH.mint(deployer, 1000 * 10 ** 18); // 1,000 SOPH
            console.log("Minted initial tokens to deployer");
        } else {
            // Use existing testnet addresses
            usdcAddress = vm.envOr("USDC_ADDRESS", TESTNET_USDC);
            sophAddress = vm.envOr("SOPH_ADDRESS", TESTNET_SOPH);
        }

        console.log("Deploying contracts with:");
        console.log("  Deployer:", deployer);
        console.log("  USDC:", usdcAddress);
        console.log("  SOPH:", sophAddress);
        console.log("  Paymaster:", TESTNET_PAYMASTER);

        // Deploy Store implementation
        StoreV2 storeImpl = new StoreV2();
        console.log("Store implementation deployed at:", address(storeImpl));

        // Deploy Store proxy
        bytes memory storeInitData = abi.encodeWithSelector(
            StoreV2.initialize.selector,
            usdcAddress,
            deployer,
            INITIAL_ALBUM_PRICE
        );
        ERC1967Proxy _storeProxy = new ERC1967Proxy(address(storeImpl), storeInitData);
        console.log("Store proxy deployed at:", address(_storeProxy));

        // Deploy Jobs implementation
        JobsV2 jobsImpl = new JobsV2();
        console.log("Jobs implementation deployed at:", address(jobsImpl));

        // Deploy Jobs proxy
        bytes memory jobsInitData = abi.encodeWithSelector(
            JobsV2.initialize.selector,
            usdcAddress,
            sophAddress,
            deployer,
            address(_storeProxy)
        );
        ERC1967Proxy _jobsProxy = new ERC1967Proxy(address(jobsImpl), jobsInitData);
        console.log("Jobs proxy deployed at:", address(_jobsProxy));

        // Grant WITHDRAWER_ROLE to Jobs contract on Store
        StoreV2 store = StoreV2(address(_storeProxy));
        store.grantRole(store.WITHDRAWER_ROLE(), address(_jobsProxy));
        console.log("Granted WITHDRAWER_ROLE to Jobs contract");

        vm.stopBroadcast();

        // Output deployment summary
        console.log("\n========================================");
        console.log("TESTNET DEPLOYMENT COMPLETE");
        console.log("========================================");
        console.log("Network: Sophon Testnet");
        console.log("USDC Address:", usdcAddress);
        console.log("SOPH Address:", sophAddress);
        console.log("Store Proxy:", address(_storeProxy));
        console.log("Store Implementation:", address(storeImpl));
        console.log("Jobs Proxy:", address(_jobsProxy));
        console.log("Jobs Implementation:", address(jobsImpl));
        console.log("Admin:", deployer);
        console.log("Initial Album Price: 0.01 USDC");
        console.log("========================================");
        console.log("\nUpdate your frontend/.env with:");
        console.log("NEXT_PUBLIC_STORE_CONTRACT=", address(_storeProxy));
        console.log("NEXT_PUBLIC_JOBS_CONTRACT=", address(_jobsProxy));
        console.log("========================================");

        // Save deployment info to file
        string memory deploymentInfo = string.concat(
            "# Sophon Testnet Deployment\n",
            "STORE_PROXY=", vm.toString(address(_storeProxy)), "\n",
            "STORE_IMPL=", vm.toString(address(storeImpl)), "\n",
            "JOBS_PROXY=", vm.toString(address(_jobsProxy)), "\n",
            "JOBS_IMPL=", vm.toString(address(jobsImpl)), "\n",
            "USDC_ADDRESS=", vm.toString(usdcAddress), "\n",
            "SOPH_ADDRESS=", vm.toString(sophAddress), "\n",
            "ADMIN=", vm.toString(deployer), "\n"
        );
        vm.writeFile("deployed-addresses-testnet.txt", deploymentInfo);

        return (address(_storeProxy), address(_jobsProxy), usdcAddress, sophAddress);
    }
}