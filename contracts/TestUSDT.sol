// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TestUSDT is ERC20, Ownable {
    uint8 private _decimals;
    
    constructor() ERC20("Test USDT", "TUSDT") {
        _decimals = 18;
        // Mint 1 million test USDT to deployer
        _mint(msg.sender, 1000000 * 10**decimals());
    }
    
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
    
    // Allow anyone to mint test tokens (for testing only)
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
    
    // Faucet function - gives 1000 TUSDT to anyone who calls it
    function faucet() public {
        _mint(msg.sender, 1000 * 10**decimals());
    }
    
    // Owner can mint tokens to any address
    function ownerMint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}