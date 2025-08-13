// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {StoreV2} from "../src/StoreV2.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockUSDC {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }
}

contract StoreV2Test is Test {
    StoreV2 public storeImpl;
    StoreV2 public store;
    MockUSDC public usdc;
    
    address public admin = address(0x1);
    address public user = address(0x2);
    uint256 public constant ALBUM_PRICE = 10_000; // 0.01 USDC

    function setUp() public {
        // Deploy mock USDC
        usdc = new MockUSDC();
        
        // Deploy implementation
        storeImpl = new StoreV2();
        
        // Deploy proxy
        bytes memory initData = abi.encodeWithSelector(
            StoreV2.initialize.selector,
            address(usdc),
            admin,
            ALBUM_PRICE
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(storeImpl), initData);
        store = StoreV2(address(proxy));
        
        // Setup user with USDC
        usdc.mint(user, 1_000_000); // 1 USDC
        vm.prank(user);
        usdc.approve(address(store), type(uint256).max);
    }

    function testInitialization() public view {
        assertEq(address(store.usdc()), address(usdc));
        assertEq(store.albumPrice(), ALBUM_PRICE);
        assertTrue(store.hasRole(store.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(store.hasRole(store.ADMIN_ROLE(), admin));
    }

    function testBuyAlbum() public {
        vm.prank(user);
        store.buyAlbum();
        
        assertTrue(store.hasPurchased(user));
        assertEq(store.totalPurchases(), 1);
        assertEq(store.totalRevenue(), ALBUM_PRICE);
        assertEq(usdc.balanceOf(address(store)), ALBUM_PRICE);
    }

    function testCannotBuyTwice() public {
        vm.prank(user);
        store.buyAlbum();
        
        vm.expectRevert("Already purchased");
        vm.prank(user);
        store.buyAlbum();
    }

    function testWithdrawFunds() public {
        // Buy album first
        vm.prank(user);
        store.buyAlbum();
        
        // Withdraw as admin
        vm.prank(admin);
        store.withdrawFunds(admin, ALBUM_PRICE);
        
        assertEq(usdc.balanceOf(admin), ALBUM_PRICE);
        assertEq(usdc.balanceOf(address(store)), 0);
    }

    function testUpdatePrice() public {
        uint256 newPrice = 20_000; // 0.02 USDC
        
        vm.prank(admin);
        store.updatePrice(newPrice);
        
        assertEq(store.albumPrice(), newPrice);
    }

    function testPauseUnpause() public {
        vm.prank(admin);
        store.pause();
        
        vm.expectRevert();
        vm.prank(user);
        store.buyAlbum();
        
        vm.prank(admin);
        store.unpause();
        
        vm.prank(user);
        store.buyAlbum();
        
        assertTrue(store.hasPurchased(user));
    }
}