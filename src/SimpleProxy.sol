// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SimpleProxy {
    address public implementation;
    address public admin;
    
    constructor(address _implementation, bytes memory _data) {
        implementation = _implementation;
        admin = msg.sender;
        
        if (_data.length > 0) {
            (bool success,) = _implementation.delegatecall(_data);
            require(success, "Initialization failed");
        }
    }
    
    fallback() external payable {
        address impl = implementation;
        assembly {
            let ptr := mload(0x40)
            calldatacopy(ptr, 0, calldatasize())
            let result := delegatecall(gas(), impl, ptr, calldatasize(), 0, 0)
            let size := returndatasize()
            returndatacopy(ptr, 0, size)
            
            switch result
            case 0 { revert(ptr, size) }
            default { return(ptr, size) }
        }
    }
    
    receive() external payable {}
}