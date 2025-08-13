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
    
    // Expected standard purchase amount (32 USDC = 4 albums @ $8 each)
    uint256 public constant EXPECTED_PURCHASE_AMOUNT = 32 * 10**6; // 32 USDC
    
    // Promotional Commission Structure (tiered based on total commissions claimed)
    // First $50M in sales: 100% commission to Nano LLC
    // Next $10M: 90% commission  
    // Next $10M: 80% commission, decreasing by 10% each $10M
    // Eventually reaches 0% after $140M total claimed
    uint256 public constant PROMO_TIER_SIZE = 10_000_000 * 10**6; // $10M USDC
    uint256 public constant PROMO_FIRST_TIER = 50_000_000 * 10**6; // $50M USDC at 100%
    uint256 public totalCommissionsClaimed;

    event AlbumPurchased(address indexed buyer, uint256 price);
    event PriceUpdated(uint256 oldPrice, uint256 newPrice);
    event FundsWithdrawn(address indexed to, uint256 amount);
    event ReferralCommissionsClaimed(address indexed claimedBy, address indexed sentTo, uint256 amount, uint256 commissionRate);

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
        albumPrice = _initialPrice; // Should be 8 * 10**6 for $8 albums

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

    // Calculate current commission rate based on promotional tier system
    function getCurrentCommissionRate() public view returns (uint256) {
        if (totalCommissionsClaimed < PROMO_FIRST_TIER) {
            return 100; // 100% commission for first $50M
        }
        
        uint256 excessClaimed = totalCommissionsClaimed - PROMO_FIRST_TIER;
        uint256 tiersPassed = excessClaimed / PROMO_TIER_SIZE;
        
        if (tiersPassed >= 9) {
            return 0; // 0% commission after $140M total claimed
        }
        
        // Each tier reduces commission by 10%
        return 90 - (tiersPassed * 10);
    }
    
    // Calculate claimable commission amount based on current tier
    function getClaimableCommission() public view returns (uint256) {
        uint256 balance = usdc.balanceOf(address(this));
        uint256 rate = getCurrentCommissionRate();
        return (balance * rate) / 100;
    }
    
    // Nano wallet claims referral commissions per the promotional agreement
    function claimReferralCommissions(address destination, uint256 amount) external onlyRole(COMMISSION_CLAIMER_ROLE) {
        require(destination != address(0), "Invalid destination");
        require(amount > 0, "Amount must be greater than 0");
        
        uint256 claimable = getClaimableCommission();
        require(amount <= claimable, "Amount exceeds claimable commission per agreement");
        require(amount <= usdc.balanceOf(address(this)), "Insufficient balance");

        totalCommissionsClaimed += amount;
        uint256 rate = getCurrentCommissionRate();
        
        require(usdc.transfer(destination, amount), "Commission transfer failed");
        emit ReferralCommissionsClaimed(msg.sender, destination, amount, rate);
    }

    function claimAllReferralCommissions(address destination) external onlyRole(COMMISSION_CLAIMER_ROLE) {
        uint256 claimable = getClaimableCommission();
        require(claimable > 0, "No commissions to claim at current tier");
        require(destination != address(0), "Invalid destination");

        totalCommissionsClaimed += claimable;
        uint256 rate = getCurrentCommissionRate();
        
        require(usdc.transfer(destination, claimable), "Commission transfer failed");
        emit ReferralCommissionsClaimed(msg.sender, destination, claimable, rate);
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
