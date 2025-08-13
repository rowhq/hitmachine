// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

// This contract deploys the proxies for us, working around zkSync paymaster issues
contract ProxyDeployer {
    address public immutable storeProxy;
    address public immutable jobsProxy;
    
    constructor(
        address _storeImpl,
        address _jobsImpl,
        address _usdc,
        address _admin
    ) {
        // Deploy Store proxy
        bytes memory storeInitData = abi.encodeWithSelector(
            0x8bea8753, // initialize(address,address,uint256) selector
            _usdc,
            _admin,
            32000000
        );
        storeProxy = address(new ERC1967Proxy(_storeImpl, storeInitData));
        
        // Deploy Jobs proxy
        bytes memory jobsInitData = abi.encodeWithSelector(
            0x485cc955, // initialize(address,address) selector
            _usdc,
            _admin
        );
        jobsProxy = address(new ERC1967Proxy(_jobsImpl, jobsInitData));
    }
}