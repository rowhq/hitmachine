// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin-upgradeable/contracts/access/AccessControlUpgradeable.sol";
import "@openzeppelin-upgradeable/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol";

contract RateLimiter is Initializable, AccessControlUpgradeable, UUPSUpgradeable {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant BYPASS_ROLE = keccak256("BYPASS_ROLE");
    
    // Rate limiting parameters
    uint256 public maxWalletsPerIP;
    uint256 public maxWalletsPerDay;
    uint256 public cooldownPeriod; // seconds between wallet creations per IP
    uint256 public dailyUsdcLimit;
    uint256 public dailyNativeLimit;
    
    // Tracking
    mapping(bytes32 => uint256) public ipWalletCount;
    mapping(bytes32 => uint256) public ipLastCreation;
    mapping(bytes32 => bool) public ipBlacklisted;
    mapping(address => bool) public walletWhitelisted;
    
    // Daily limits
    uint256 public currentDay;
    uint256 public walletsCreatedToday;
    uint256 public usdcDistributedToday;
    uint256 public nativeDistributedToday;
    
    // Suspicious activity tracking
    mapping(bytes32 => uint256) public suspiciousAttempts;
    uint256 public constant MAX_SUSPICIOUS_ATTEMPTS = 5;
    
    event RateLimitUpdated(string param, uint256 oldValue, uint256 newValue);
    event IPBlacklisted(bytes32 indexed ipHash, string reason);
    event IPWhitelisted(bytes32 indexed ipHash);
    event SuspiciousActivity(bytes32 indexed ipHash, string reason);
    event DailyLimitReset(uint256 day);
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    function initialize(address _admin) public initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE, _admin);
        
        // Default limits
        maxWalletsPerIP = 3;
        maxWalletsPerDay = 100;
        cooldownPeriod = 300; // 5 minutes
        dailyUsdcLimit = 10_000_000; // 10 USDC
        dailyNativeLimit = 1e18; // 1 SOPH
        
        currentDay = block.timestamp / 1 days;
    }
    
    function checkAndUpdateLimits(
        bytes32 ipHash,
        address wallet,
        uint256 usdcAmount,
        uint256 nativeAmount
    ) external returns (bool allowed, string memory reason) {
        // Check if caller has bypass role
        if (hasRole(BYPASS_ROLE, msg.sender)) {
            return (true, "Bypassed");
        }
        
        // Check if wallet is whitelisted
        if (walletWhitelisted[wallet]) {
            return (true, "Whitelisted");
        }
        
        // Check if IP is blacklisted
        if (ipBlacklisted[ipHash]) {
            return (false, "IP blacklisted");
        }
        
        // Reset daily limits if new day
        uint256 today = block.timestamp / 1 days;
        if (today > currentDay) {
            currentDay = today;
            walletsCreatedToday = 0;
            usdcDistributedToday = 0;
            nativeDistributedToday = 0;
            emit DailyLimitReset(today);
        }
        
        // Check daily wallet creation limit
        if (walletsCreatedToday >= maxWalletsPerDay) {
            _recordSuspiciousActivity(ipHash, "Daily wallet limit exceeded");
            return (false, "Daily wallet limit exceeded");
        }
        
        // Check daily USDC distribution limit
        if (usdcDistributedToday + usdcAmount > dailyUsdcLimit) {
            _recordSuspiciousActivity(ipHash, "Daily USDC limit exceeded");
            return (false, "Daily USDC limit exceeded");
        }
        
        // Check daily native distribution limit
        if (nativeDistributedToday + nativeAmount > dailyNativeLimit) {
            _recordSuspiciousActivity(ipHash, "Daily native limit exceeded");
            return (false, "Daily native limit exceeded");
        }
        
        // Check per-IP wallet limit
        if (ipWalletCount[ipHash] >= maxWalletsPerIP) {
            _recordSuspiciousActivity(ipHash, "IP wallet limit exceeded");
            return (false, "Too many wallets from this IP");
        }
        
        // Check cooldown period
        if (block.timestamp < ipLastCreation[ipHash] + cooldownPeriod) {
            uint256 timeLeft = (ipLastCreation[ipHash] + cooldownPeriod) - block.timestamp;
            _recordSuspiciousActivity(ipHash, "Cooldown not met");
            return (false, string(abi.encodePacked("Please wait ", _toString(timeLeft), " seconds")));
        }
        
        // Update counters
        ipWalletCount[ipHash]++;
        ipLastCreation[ipHash] = block.timestamp;
        walletsCreatedToday++;
        usdcDistributedToday += usdcAmount;
        nativeDistributedToday += nativeAmount;
        
        return (true, "Allowed");
    }
    
    function _recordSuspiciousActivity(bytes32 ipHash, string memory reason) private {
        suspiciousAttempts[ipHash]++;
        emit SuspiciousActivity(ipHash, reason);
        
        // Auto-blacklist after too many suspicious attempts
        if (suspiciousAttempts[ipHash] >= MAX_SUSPICIOUS_ATTEMPTS) {
            ipBlacklisted[ipHash] = true;
            emit IPBlacklisted(ipHash, "Too many suspicious attempts");
        }
    }
    
    // Admin functions
    function setMaxWalletsPerIP(uint256 _max) external onlyRole(OPERATOR_ROLE) {
        uint256 old = maxWalletsPerIP;
        maxWalletsPerIP = _max;
        emit RateLimitUpdated("maxWalletsPerIP", old, _max);
    }
    
    function setMaxWalletsPerDay(uint256 _max) external onlyRole(OPERATOR_ROLE) {
        uint256 old = maxWalletsPerDay;
        maxWalletsPerDay = _max;
        emit RateLimitUpdated("maxWalletsPerDay", old, _max);
    }
    
    function setCooldownPeriod(uint256 _seconds) external onlyRole(OPERATOR_ROLE) {
        uint256 old = cooldownPeriod;
        cooldownPeriod = _seconds;
        emit RateLimitUpdated("cooldownPeriod", old, _seconds);
    }
    
    function setDailyLimits(uint256 _usdcLimit, uint256 _nativeLimit) external onlyRole(OPERATOR_ROLE) {
        dailyUsdcLimit = _usdcLimit;
        dailyNativeLimit = _nativeLimit;
    }
    
    function blacklistIP(bytes32 ipHash) external onlyRole(OPERATOR_ROLE) {
        ipBlacklisted[ipHash] = true;
        emit IPBlacklisted(ipHash, "Manual blacklist");
    }
    
    function whitelistIP(bytes32 ipHash) external onlyRole(OPERATOR_ROLE) {
        ipBlacklisted[ipHash] = false;
        suspiciousAttempts[ipHash] = 0;
        emit IPWhitelisted(ipHash);
    }
    
    function whitelistWallet(address wallet) external onlyRole(OPERATOR_ROLE) {
        walletWhitelisted[wallet] = true;
    }
    
    function resetIPLimits(bytes32 ipHash) external onlyRole(OPERATOR_ROLE) {
        ipWalletCount[ipHash] = 0;
        ipLastCreation[ipHash] = 0;
        suspiciousAttempts[ipHash] = 0;
    }
    
    // View functions
    function getIPStatus(bytes32 ipHash) external view returns (
        uint256 walletCount,
        uint256 lastCreation,
        bool blacklisted,
        uint256 suspiciousCount,
        uint256 timeUntilNext
    ) {
        uint256 nextAllowed = ipLastCreation[ipHash] + cooldownPeriod;
        uint256 timeLeft = nextAllowed > block.timestamp ? nextAllowed - block.timestamp : 0;
        
        return (
            ipWalletCount[ipHash],
            ipLastCreation[ipHash],
            ipBlacklisted[ipHash],
            suspiciousAttempts[ipHash],
            timeLeft
        );
    }
    
    function getDailyStats() external view returns (
        uint256 day,
        uint256 walletsCreated,
        uint256 usdcDistributed,
        uint256 nativeDistributed,
        uint256 walletsRemaining,
        uint256 usdcRemaining,
        uint256 nativeRemaining
    ) {
        return (
            currentDay,
            walletsCreatedToday,
            usdcDistributedToday,
            nativeDistributedToday,
            maxWalletsPerDay - walletsCreatedToday,
            dailyUsdcLimit - usdcDistributedToday,
            dailyNativeLimit - nativeDistributedToday
        );
    }
    
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
    
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}