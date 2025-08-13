// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin-upgradeable/contracts/access/AccessControlUpgradeable.sol";
import "@openzeppelin-upgradeable/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin-upgradeable/contracts/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin-upgradeable/contracts/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IStore {
    function withdrawAll(address to) external;
    function withdrawFunds(address to, uint256 amount) external;
    function getContractBalance() external view returns (uint256);
}

contract JobsV2 is
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");

    IERC20 public usdc;
    IERC20 public nativeToken; // SOPH token
    IStore public storeContract;

    uint256 public totalUsdcDistributed;
    uint256 public totalNativeDistributed;
    uint256 public totalUsersPaid;
    uint256 public totalClaimedFromStore;

    mapping(address => uint256) public userPaymentTimestamp;
    mapping(address => uint256) public usdcPaid;
    mapping(address => uint256) public nativePaid;

    event CatFeederPaid(address indexed user, uint256 usdcAmount, uint256 nativeAmount, uint256 timestamp);
    event FundsDeposited(address indexed from, uint256 usdcAmount, uint256 nativeAmount);
    event EmergencyWithdraw(address indexed to, address token, uint256 amount);
    event ClaimedFromStore(uint256 amount, uint256 timestamp);
    event StoreContractUpdated(address oldStore, address newStore);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _usdc, address _nativeToken, address _admin, address _storeContract)
        public
        initializer
    {
        require(_usdc != address(0), "Invalid USDC address");
        require(_nativeToken != address(0), "Invalid native token address");
        require(_admin != address(0), "Invalid admin address");
        require(_storeContract != address(0), "Invalid store contract address");

        __AccessControl_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        usdc = IERC20(_usdc);
        nativeToken = IERC20(_nativeToken);
        storeContract = IStore(_storeContract);

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE, _admin);
        _grantRole(DISTRIBUTOR_ROLE, _admin);
    }

    function claimFromStore() external nonReentrant onlyRole(OPERATOR_ROLE) {
        uint256 storeBalance = storeContract.getContractBalance();
        require(storeBalance > 0, "No funds to claim from store");

        uint256 balanceBefore = usdc.balanceOf(address(this));
        storeContract.withdrawAll(address(this));
        uint256 balanceAfter = usdc.balanceOf(address(this));

        uint256 claimed = balanceAfter - balanceBefore;
        totalClaimedFromStore += claimed;

        emit ClaimedFromStore(claimed, block.timestamp);
    }

    function claimAmountFromStore(uint256 amount) external nonReentrant onlyRole(OPERATOR_ROLE) {
        require(amount > 0, "Amount must be greater than 0");
        uint256 storeBalance = storeContract.getContractBalance();
        require(amount <= storeBalance, "Amount exceeds store balance");

        uint256 balanceBefore = usdc.balanceOf(address(this));
        storeContract.withdrawFunds(address(this), amount);
        uint256 balanceAfter = usdc.balanceOf(address(this));

        uint256 claimed = balanceAfter - balanceBefore;
        totalClaimedFromStore += claimed;

        emit ClaimedFromStore(claimed, block.timestamp);
    }

    function payCatFeeder(address user, uint256 usdcAmount, uint256 nativeAmount)
        external
        nonReentrant
        whenNotPaused
        onlyRole(DISTRIBUTOR_ROLE)
    {
        require(user != address(0), "Invalid user address");
        require(usdcAmount > 0 || nativeAmount > 0, "Must pay with at least one token");

        _payCatFeeder(user, usdcAmount, nativeAmount);
    }

    function _payCatFeeder(address user, uint256 usdcAmount, uint256 nativeAmount) private {
        if (usdcAmount > 0) {
            require(usdc.balanceOf(address(this)) >= usdcAmount, "Insufficient USDC balance");
            require(usdc.transfer(user, usdcAmount), "USDC transfer failed");
            usdcPaid[user] += usdcAmount;
            totalUsdcDistributed += usdcAmount;
        }

        if (nativeAmount > 0) {
            require(nativeToken.balanceOf(address(this)) >= nativeAmount, "Insufficient native balance");
            require(nativeToken.transfer(user, nativeAmount), "Native transfer failed");
            nativePaid[user] += nativeAmount;
            totalNativeDistributed += nativeAmount;
        }

        if (userPaymentTimestamp[user] == 0) {
            totalUsersPaid++;
        }
        userPaymentTimestamp[user] = block.timestamp;

        emit CatFeederPaid(user, usdcAmount, nativeAmount, block.timestamp);
    }

    function depositFunds(uint256 usdcAmount, uint256 nativeAmount) external {
        require(usdcAmount > 0 || nativeAmount > 0, "Must deposit at least one token");

        if (usdcAmount > 0) {
            require(usdc.transferFrom(msg.sender, address(this), usdcAmount), "USDC deposit failed");
        }

        if (nativeAmount > 0) {
            require(nativeToken.transferFrom(msg.sender, address(this), nativeAmount), "Native deposit failed");
        }

        emit FundsDeposited(msg.sender, usdcAmount, nativeAmount);
    }

    function emergencyWithdraw(address token, address to, uint256 amount) external onlyRole(ADMIN_ROLE) {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be greater than 0");

        IERC20 tokenContract = IERC20(token);
        require(tokenContract.balanceOf(address(this)) >= amount, "Insufficient balance");
        require(tokenContract.transfer(to, amount), "Emergency withdraw failed");

        emit EmergencyWithdraw(to, token, amount);
    }

    function updateStoreContract(address _storeContract) external onlyRole(ADMIN_ROLE) {
        require(_storeContract != address(0), "Invalid store contract address");
        address oldStore = address(storeContract);
        storeContract = IStore(_storeContract);
        emit StoreContractUpdated(oldStore, _storeContract);
    }

    function pause() external onlyRole(OPERATOR_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(OPERATOR_ROLE) {
        _unpause();
    }

    // Utility view functions
    function getBalances() external view returns (uint256 usdcBalance, uint256 nativeBalance) {
        return (usdc.balanceOf(address(this)), nativeToken.balanceOf(address(this)));
    }

    function getStats()
        external
        view
        returns (
            uint256 usersPaid,
            uint256 usdcDistributed,
            uint256 nativeDistributed,
            uint256 claimedFromStore,
            uint256 currentUsdcBalance,
            uint256 currentNativeBalance
        )
    {
        return (
            totalUsersPaid,
            totalUsdcDistributed,
            totalNativeDistributed,
            totalClaimedFromStore,
            usdc.balanceOf(address(this)),
            nativeToken.balanceOf(address(this))
        );
    }

    function getUserPaymentInfo(address user)
        external
        view
        returns (uint256 timestamp, uint256 usdcReceived, uint256 nativeReceived)
    {
        return (userPaymentTimestamp[user], usdcPaid[user], nativePaid[user]);
    }

    function canFund(uint256 usdcAmount, uint256 nativeAmount) external view returns (bool) {
        if (paused()) return false;
        if (usdcAmount > 0 && usdc.balanceOf(address(this)) < usdcAmount) return false;
        if (nativeAmount > 0 && nativeToken.balanceOf(address(this)) < nativeAmount) return false;
        return true;
    }

    function getStoreBalance() external view returns (uint256) {
        return storeContract.getContractBalance();
    }

    // Required for UUPS pattern
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    // Allow updating token addresses if needed (for upgrades)
    function setTokens(address _usdc, address _nativeToken) external onlyRole(ADMIN_ROLE) {
        if (_usdc != address(0)) {
            usdc = IERC20(_usdc);
        }
        if (_nativeToken != address(0)) {
            nativeToken = IERC20(_nativeToken);
        }
    }
}
