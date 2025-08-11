// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDC
 * @dev A mock USDC token for testing on Sophon testnet
 * Anyone can mint tokens for testing purposes
 */
contract MockUSDC is ERC20, Ownable {
    uint256 public constant MINT_AMOUNT = 1000 * 10 ** 6; // 1000 USDC per mint
    mapping(address => uint256) public lastMintTime;
    uint256 public constant MINT_COOLDOWN = 1 hours;

    constructor() ERC20("Mock USDC", "mUSDC") Ownable(msg.sender) {}

    function decimals() public pure override returns (uint8) {
        return 6; // USDC has 6 decimals
    }

    /**
     * @dev Public mint function for testing
     * Users can mint 1000 USDC every hour
     */
    function mint() external {
        require(
            block.timestamp >= lastMintTime[msg.sender] + MINT_COOLDOWN,
            "Please wait before minting again"
        );
        
        lastMintTime[msg.sender] = block.timestamp;
        _mint(msg.sender, MINT_AMOUNT);
    }

    /**
     * @dev Owner can mint any amount to any address
     */
    function mintTo(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev Mint specific amount to caller (owner only)
     */
    function mintAmount(uint256 amount) external onlyOwner {
        _mint(msg.sender, amount);
    }

    /**
     * @dev Get time until next mint for an address
     */
    function timeUntilNextMint(address user) external view returns (uint256) {
        uint256 lastMint = lastMintTime[user];
        if (lastMint == 0) return 0;
        
        uint256 nextMintTime = lastMint + MINT_COOLDOWN;
        if (block.timestamp >= nextMintTime) return 0;
        
        return nextMintTime - block.timestamp;
    }
}