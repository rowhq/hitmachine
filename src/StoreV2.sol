// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin-upgradeable/contracts/access/AccessControlUpgradeable.sol";
import "@openzeppelin-upgradeable/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin-upgradeable/contracts/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract StoreV2 is
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    PausableUpgradeable
{
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant WITHDRAWER_ROLE = keccak256("WITHDRAWER_ROLE");
    bytes32 public constant COMMISSION_CLAIMER_ROLE = keccak256("COMMISSION_CLAIMER_ROLE");

    IERC20 public usdc;
    uint256 public albumPrice;
    uint256 public totalPurchases;
    uint256 public totalRevenue;
    
    // Expected standard purchase amount (32 USDC = 3200 albums)
    uint256 public constant EXPECTED_PURCHASE_AMOUNT = 32 * 10**6; // 32 USDC

    event AlbumPurchased(address indexed buyer, uint256 price);
    event PriceUpdated(uint256 oldPrice, uint256 newPrice);
    event FundsWithdrawn(address indexed to, uint256 amount);
    event ReferralCommissionsClaimed(address indexed claimedBy, address indexed sentTo, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _usdc, address _admin, uint256 _initialPrice) public initializer {
        require(_usdc != address(0), "Invalid USDC address");
        require(_admin != address(0), "Invalid admin address");
        require(_initialPrice > 0, "Price must be greater than 0");

        __AccessControl_init();
        __UUPSUpgradeable_init();
        __Pausable_init();

        usdc = IERC20(_usdc);
        albumPrice = _initialPrice;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE, _admin);
        _grantRole(WITHDRAWER_ROLE, _admin);
        // Note: COMMISSION_CLAIMER_ROLE should be granted to nano wallet separately
    }

    function buyAlbums() external whenNotPaused {
        // Calculate how many albums can be purchased with user's approved USDC
        uint256 userAllowance = usdc.allowance(msg.sender, address(this));
        uint256 userBalance = usdc.balanceOf(msg.sender);
        uint256 availableAmount = userAllowance < userBalance ? userAllowance : userBalance;
        
        require(availableAmount >= albumPrice, "Insufficient funds or allowance");
        
        // Calculate number of albums to purchase
        uint256 albumCount = availableAmount / albumPrice;
        uint256 totalCost = albumCount * albumPrice;
        
        require(albumCount > 0, "Cannot purchase zero albums");
        require(usdc.transferFrom(msg.sender, address(this), totalCost), "Payment failed");

        totalPurchases += albumCount;
        totalRevenue += totalCost;

        emit AlbumPurchased(msg.sender, totalCost);
    }
    
    // Helper function to calculate how many albums for a given amount
    function calculateAlbumCount(uint256 usdcAmount) external view returns (uint256) {
        return usdcAmount / albumPrice;
    }
    
    // Check if standard amount would buy expected albums
    function getExpectedAlbumCount() external view returns (uint256) {
        return EXPECTED_PURCHASE_AMOUNT / albumPrice;
    }

    // Admin withdrawal function
    function withdrawFunds(address to, uint256 amount) external onlyRole(WITHDRAWER_ROLE) {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be greater than 0");
        require(amount <= usdc.balanceOf(address(this)), "Insufficient balance");

        require(usdc.transfer(to, amount), "Withdraw failed");
        emit FundsWithdrawn(to, amount);
    }

    // Nano wallet claims referral commissions and directs where to send them
    function claimReferralCommissions(address destination, uint256 amount) external onlyRole(COMMISSION_CLAIMER_ROLE) {
        require(destination != address(0), "Invalid destination");
        require(amount > 0, "Amount must be greater than 0");
        require(amount <= usdc.balanceOf(address(this)), "Insufficient balance");

        require(usdc.transfer(destination, amount), "Commission transfer failed");
        emit ReferralCommissionsClaimed(msg.sender, destination, amount);
    }

    function claimAllReferralCommissions(address destination) external onlyRole(COMMISSION_CLAIMER_ROLE) {
        uint256 balance = usdc.balanceOf(address(this));
        require(balance > 0, "No commissions to claim");
        require(destination != address(0), "Invalid destination");

        require(usdc.transfer(destination, balance), "Commission transfer failed");
        emit ReferralCommissionsClaimed(msg.sender, destination, balance);
    }

    function withdrawAll(address to) external onlyRole(WITHDRAWER_ROLE) {
        uint256 balance = usdc.balanceOf(address(this));
        require(balance > 0, "No funds to withdraw");
        require(to != address(0), "Invalid recipient");

        require(usdc.transfer(to, balance), "Withdraw failed");
        emit FundsWithdrawn(to, balance);
    }

    function updatePrice(uint256 newPrice) external onlyRole(OPERATOR_ROLE) {
        require(newPrice > 0, "Price must be greater than 0");
        uint256 oldPrice = albumPrice;
        albumPrice = newPrice;
        emit PriceUpdated(oldPrice, newPrice);
    }

    function pause() external onlyRole(OPERATOR_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(OPERATOR_ROLE) {
        _unpause();
    }

    // Utility view functions
    function getContractBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    function getStats() external view returns (uint256 price, uint256 purchases, uint256 revenue, uint256 balance) {
        return (albumPrice, totalPurchases, totalRevenue, usdc.balanceOf(address(this)));
    }

    function canBuy(address buyer) external view returns (bool) {
        return !paused();
    }

    // Required for UUPS pattern
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    // Allow setting new USDC address if needed (for upgrades)
    function setUSDC(address _usdc) external onlyRole(ADMIN_ROLE) {
        require(_usdc != address(0), "Invalid USDC address");
        usdc = IERC20(_usdc);
    }
}
