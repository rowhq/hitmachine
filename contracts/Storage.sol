// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract Storage {
    address public admin;
    address public usdc;
    uint256 public constant PRICE = 0.01 * 10 ** 6; // 0.01 USDC with 6 decimals (For testing. In prod we will bump this to 8 bucks)

    mapping(address => bool) public hasPurchased;

    constructor(address _usdc, address _admin) {
        admin = _admin;
        usdc = _usdc;
    }

    function buyAlbum() external {
        require(!hasPurchased[msg.sender], "Already purchased");
        require(
            IERC20(usdc).transferFrom(msg.sender, address(this), PRICE),
            "Payment failed"
        );
        hasPurchased[msg.sender] = true;
    }

    function claimReferral(address to, uint256 amount) external {
        require(msg.sender == admin, "Not admin");
        require(IERC20(usdc).transfer(to, amount), "Withdraw failed");
    }
}
