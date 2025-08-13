// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin-upgradeable/contracts/access/AccessControlUpgradeable.sol";
import "@openzeppelin-upgradeable/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin-upgradeable/contracts/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin-upgradeable/contracts/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Jobs contract: Pays workers for completing jobs (like wallet generation)
// Funded by referral commissions claimed from the Store contract
contract Jobs is
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant JOB_PAYER_ROLE = keccak256("JOB_PAYER_ROLE"); // For nano wallet

    IERC20 public usdc;
    
    // Standard job payment amount (32 USDC = 3200 albums at 0.01 each)
    uint256 public standardJobAmount;

    // Job payment tracking (funded by commissions from Store)
    uint256 public totalUsdcPaidForJobs;
    uint256 public totalJobsPaid;

    event JobPaymentSent(address indexed worker, uint256 usdcAmount, uint256 timestamp);
    event FundsReceived(address indexed from, uint256 usdcAmount); // When receiving commission funds from Store
    event EmergencyWithdraw(address indexed to, address token, uint256 amount);
    event StandardAmountUpdated(uint256 oldAmount, uint256 newAmount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _usdc, address _admin)
        public
        initializer
    {
        require(_usdc != address(0), "Invalid USDC address");
        require(_admin != address(0), "Invalid admin address");

        __AccessControl_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        usdc = IERC20(_usdc);
        standardJobAmount = 32 * 10**6; // 32 USDC (USDC has 6 decimals)

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        // Note: JOB_PAYER_ROLE should be granted to nano wallet separately
    }

    function payForJob(address worker)
        external
        nonReentrant
        whenNotPaused
        onlyRole(JOB_PAYER_ROLE)
    {
        require(worker != address(0), "Invalid worker address");
        require(usdc.balanceOf(address(this)) >= standardJobAmount, "Insufficient USDC for job payment");
        
        require(usdc.transfer(worker, standardJobAmount), "USDC job payment failed");
        
        totalUsdcPaidForJobs += standardJobAmount;
        totalJobsPaid++;

        emit JobPaymentSent(worker, standardJobAmount, block.timestamp);
    }

    // Admin function to update standard job amount
    function setStandardJobAmount(uint256 newAmount) external onlyRole(ADMIN_ROLE) {
        require(newAmount > 0, "Amount must be greater than 0");
        uint256 oldAmount = standardJobAmount;
        standardJobAmount = newAmount;
        emit StandardAmountUpdated(oldAmount, newAmount);
    }

    // Receives funds (typically commission payouts from Store contract)
    function receiveFunds(uint256 usdcAmount) external {
        require(usdcAmount > 0, "Amount must be greater than 0");
        require(usdc.transferFrom(msg.sender, address(this), usdcAmount), "USDC transfer failed");
        
        emit FundsReceived(msg.sender, usdcAmount);
    }

    function emergencyWithdraw(address token, address to, uint256 amount) external onlyRole(ADMIN_ROLE) {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be greater than 0");

        IERC20 tokenContract = IERC20(token);
        require(tokenContract.balanceOf(address(this)) >= amount, "Insufficient balance");
        require(tokenContract.transfer(to, amount), "Emergency withdraw failed");

        emit EmergencyWithdraw(to, token, amount);
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // Utility view functions
    function getBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    function getStats()
        external
        view
        returns (
            uint256 jobsPaid,
            uint256 usdcPaidForJobs,
            uint256 currentUsdcBalance,
            uint256 currentStandardAmount
        )
    {
        return (
            totalJobsPaid,
            totalUsdcPaidForJobs,
            usdc.balanceOf(address(this)),
            standardJobAmount
        );
    }

    function canPayForJob() external view returns (bool) {
        if (paused()) return false;
        if (usdc.balanceOf(address(this)) < standardJobAmount) return false;
        return true;
    }

    // Required for UUPS pattern
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    // Allow updating USDC address if needed (for upgrades)
    function setUSDC(address _usdc) external onlyRole(ADMIN_ROLE) {
        require(_usdc != address(0), "Invalid USDC address");
        usdc = IERC20(_usdc);
    }
}
