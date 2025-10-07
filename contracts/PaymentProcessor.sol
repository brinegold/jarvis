// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract PaymentProcessor is Ownable, ReentrancyGuard {
    IERC20 public usdtToken;
    
    address public adminFeeWallet;
    address public globalAdminWallet;
    
    uint256 public depositFeePercent = 2; // 2% fee on deposits
    uint256 public withdrawalFeePercent = 5; // 5% fee on withdrawals
    
    mapping(address => bool) public authorizedProcessors;
    mapping(string => bool) public processedTransactions;
    
    event DepositProcessed(
        address indexed userWallet,
        string txHash,
        uint256 amount,
        uint256 adminFee,
        uint256 userAmount
    );
    
    event WithdrawalProcessed(
        address indexed userWallet,
        uint256 amount,
        uint256 fee,
        uint256 netAmount
    );
    
    modifier onlyAuthorized() {
        require(authorizedProcessors[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }
    
    constructor(
        address _usdtToken,
        address _adminFeeWallet,
        address _globalAdminWallet
    ) {
        usdtToken = IERC20(_usdtToken);
        adminFeeWallet = _adminFeeWallet;
        globalAdminWallet = _globalAdminWallet;
    }
    
    function processDeposit(
        address userWallet,
        string memory txHash,
        uint256 amount
    ) external onlyAuthorized nonReentrant {
        require(!processedTransactions[txHash], "Transaction already processed");
        require(amount > 0, "Amount must be greater than 0");
        
        // Mark transaction as processed
        processedTransactions[txHash] = true;
        
        // Calculate fees
        uint256 adminFee = (amount * depositFeePercent) / 100;
        uint256 userAmount = amount - adminFee;
        
        // Transfer tokens from user wallet to admin wallets
        require(usdtToken.transferFrom(userWallet, adminFeeWallet, adminFee), "Admin fee transfer failed");
        require(usdtToken.transferFrom(userWallet, globalAdminWallet, userAmount), "User amount transfer failed");
        
        emit DepositProcessed(userWallet, txHash, amount, adminFee, userAmount);
    }
    
    function processWithdrawal(
        address userWallet,
        uint256 amount
    ) external onlyAuthorized nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        
        // Calculate fees
        uint256 fee = (amount * withdrawalFeePercent) / 100;
        uint256 netAmount = amount - fee;
        
        // Transfer fee to admin wallet
        require(usdtToken.transferFrom(globalAdminWallet, adminFeeWallet, fee), "Fee transfer failed");
        
        // Transfer net amount to user
        require(usdtToken.transferFrom(globalAdminWallet, userWallet, netAmount), "Withdrawal transfer failed");
        
        emit WithdrawalProcessed(userWallet, amount, fee, netAmount);
    }
    
    function addAuthorizedProcessor(address processor) external onlyOwner {
        authorizedProcessors[processor] = true;
    }
    
    function removeAuthorizedProcessor(address processor) external onlyOwner {
        authorizedProcessors[processor] = false;
    }
    
    function updateWallets(address _adminFeeWallet, address _globalAdminWallet) external onlyOwner {
        adminFeeWallet = _adminFeeWallet;
        globalAdminWallet = _globalAdminWallet;
    }
    
    function updateFees(uint256 _depositFee, uint256 _withdrawalFee) external onlyOwner {
        require(_depositFee <= 10 && _withdrawalFee <= 20, "Fees too high");
        depositFeePercent = _depositFee;
        withdrawalFeePercent = _withdrawalFee;
    }
}
