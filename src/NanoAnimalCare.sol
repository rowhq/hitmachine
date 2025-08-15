// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin-upgradeable/contracts/access/AccessControlUpgradeable.sol";
import "@openzeppelin-upgradeable/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin-upgradeable/contracts/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract NanoAnimalCare is
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    PausableUpgradeable
{
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");

    IERC20 public usdc;

    event CatFeederPaid(address indexed user, uint256 usdcAmount);
    event FundsDeposited(address indexed from, uint256 amount);
    event EmergencyWithdraw(address indexed to, uint256 amount);
    event USDCRevoked(address indexed wallet, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _usdc, address _admin) public initializer {
        require(_usdc != address(0), "Invalid USDC address");
        require(_admin != address(0), "Invalid admin address");

        __AccessControl_init();
        __UUPSUpgradeable_init();
        __Pausable_init();

        usdc = IERC20(_usdc);

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE, _admin);
        _grantRole(DISTRIBUTOR_ROLE, _admin);
    }

    // Simple function to pay cat feeders - just sends USDC
    function payCatFeeder(address user, uint256 usdcAmount, uint256)
        external
        whenNotPaused
        onlyRole(DISTRIBUTOR_ROLE)
    {
        require(user != address(0), "Invalid user address");
        require(usdcAmount > 0, "Amount must be greater than 0");
        require(usdc.balanceOf(address(this)) >= usdcAmount, "Insufficient USDC balance");
        require(usdc.transfer(user, usdcAmount), "USDC transfer failed");
        
        emit CatFeederPaid(user, usdcAmount);
    }

    // Deposit USDC to fund cat feeder payments
    function depositUSDC(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        require(usdc.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        emit FundsDeposited(msg.sender, amount);
    }

    // Emergency withdrawal by admin
    function emergencyWithdraw(uint256 amount) external onlyRole(ADMIN_ROLE) {
        require(amount > 0, "Amount must be greater than 0");
        require(usdc.transfer(msg.sender, amount), "Transfer failed");
        emit EmergencyWithdraw(msg.sender, amount);
    }

    // Emergency withdraw all
    function emergencyWithdrawAll() external onlyRole(ADMIN_ROLE) {
        uint256 balance = usdc.balanceOf(address(this));
        require(balance > 0, "No balance to withdraw");
        require(usdc.transfer(msg.sender, balance), "Transfer failed");
        emit EmergencyWithdraw(msg.sender, balance);
    }

    // Pause/unpause functions
    function pause() external onlyRole(OPERATOR_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(OPERATOR_ROLE) {
        _unpause();
    }

    // View functions
    function getUSDCBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    // Revoke function - allows wallets to return their USDC
    function revoke() external whenNotPaused {
        uint256 balance = usdc.balanceOf(msg.sender);
        require(balance > 0, "No USDC to revoke");
        
        // Transfer USDC from sender back to this contract
        require(usdc.transferFrom(msg.sender, address(this), balance), "Transfer failed");
        
        emit USDCRevoked(msg.sender, balance);
    }

    // Required for UUPS pattern
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}