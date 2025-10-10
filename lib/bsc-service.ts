import Web3 from 'web3';
import { Contract } from 'web3-eth-contract';
import crypto from 'crypto';

interface BSCConfig {
  rpcUrl: string;
  contractAddress: string;
  usdtContractAddress: string;
  adminFeeWallet: string;
  globalAdminWallet: string;
  privateKey: string;
}

class BSCService {
  private web3: Web3;
  private contract!: Contract<any>;
  private usdtContract!: Contract<any>;
  private config: BSCConfig;
  private account: any;

  constructor(config: BSCConfig) {
    this.config = config;
    
    // Use BSC mainnet RPC URL
    const rpcUrl = config.rpcUrl || "https://bsc-dataseed1.binance.org/";
    console.log("BSC Service initialized with RPC:", rpcUrl);
    
    this.web3 = new Web3(rpcUrl);
    
    // Test connection
    this.testConnection();
    
    // Ensure private key has 0x prefix
    const privateKey = config.privateKey.startsWith('0x') ? config.privateKey : `0x${config.privateKey}`;
    this.account = this.web3.eth.accounts.privateKeyToAccount(privateKey);
    this.web3.eth.accounts.wallet.add(this.account);
    
    // Initialize contracts
    this.initializeContracts();
  }

  private async testConnection() {
    try {
      const chainId = await this.web3.eth.getChainId();
      const blockNumber = await this.web3.eth.getBlockNumber();
      console.log(`Connected to BSC network - Chain ID: ${chainId}, Block: ${blockNumber}`);
      
      if (chainId !== BigInt(56)) { // BSC mainnet chain ID
        console.warn(`Warning: Expected BSC mainnet (56) but connected to chain ${chainId}`);
      }
    } catch (error) {
      console.error("Failed to connect to BSC network:", error);
    }
  }

  private initializeContracts() {
    // Payment Processor Contract ABI
    const paymentProcessorABI = [
      {
        "inputs": [
          {"name": "userWallet", "type": "address"},
          {"name": "txHash", "type": "string"},
          {"name": "amount", "type": "uint256"}
        ],
        "name": "processDeposit",
        "outputs": [],
        "type": "function"
      },
      {
        "inputs": [
          {"name": "userWallet", "type": "address"},
          {"name": "amount", "type": "uint256"}
        ],
        "name": "processWithdrawal",
        "outputs": [],
        "type": "function"
      }
    ];

    // USDT Contract ABI (simplified)
    const usdtABI = [
      {
        "inputs": [{"name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function"
      },
      {
        "inputs": [
          {"name": "to", "type": "address"},
          {"name": "amount", "type": "uint256"}
        ],
        "name": "transfer",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function"
      }
    ];

    this.contract = new this.web3.eth.Contract(paymentProcessorABI, this.config.contractAddress);
    this.usdtContract = new this.web3.eth.Contract(usdtABI, this.config.usdtContractAddress);
  }

  // Generate unique wallet address for each user
  generateUserWallet(userId: string): { address: string; privateKey: string } {
    const seed = `${userId}-${process.env.WALLET_SEED || 'jarvis-ai-seed'}`;
    const hash = crypto.createHash('sha256').update(seed).digest('hex');
    const account = this.web3.eth.accounts.privateKeyToAccount('0x' + hash);
    
    return {
      address: account.address,
      privateKey: account.privateKey
    };
  }

  // Verify transaction hash and get transaction details
  async verifyTransaction(txHash: string): Promise<any> {
    try {
      console.log(`Verifying transaction: ${txHash}`);
      
      // Validate transaction hash format
      if (!txHash || !txHash.startsWith('0x') || txHash.length !== 66) {
        throw new Error(`Invalid transaction hash format: ${txHash}. Must be 66 characters starting with 0x`);
      }
      
      // Get transaction and receipt
      const [transaction, receipt] = await Promise.all([
        this.web3.eth.getTransaction(txHash),
        this.web3.eth.getTransactionReceipt(txHash)
      ]);
      
      if (!transaction) {
        throw new Error(`Transaction ${txHash} not found`);
      }
      
      if (!receipt) {
        throw new Error(`Transaction ${txHash} receipt not found - may still be pending`);
      }

      // Verify transaction is confirmed
      if (!receipt.status) {
        throw new Error('Transaction failed on blockchain');
      }

      // Extract USDT transfer amount from transaction logs
      let usdtTransferAmount = '0';
      let actualRecipient = transaction.to;
      
      if (transaction.to?.toLowerCase() === this.config.usdtContractAddress.toLowerCase()) {
        // This is a USDT token transfer
        const transferAmount = this.extractUSDTTransferFromLogs(receipt.logs);
        if (transferAmount) {
          usdtTransferAmount = transferAmount.amount;
          actualRecipient = transferAmount.to;
          console.log(`USDT Transfer detected: ${usdtTransferAmount} USDT to ${actualRecipient}`);
        }
      }

      return {
        from: transaction.from,
        to: transaction.to,
        actualRecipient: actualRecipient,
        value: transaction.value?.toString(),
        usdtTransferAmount: usdtTransferAmount,
        blockNumber: receipt.blockNumber?.toString(),
        confirmed: true,
        gasUsed: receipt.gasUsed?.toString(),
        status: receipt.status,
        logs: receipt.logs
      };
    } catch (error: any) {
      console.error('Error verifying transaction:', error);
      throw error;
    }
  }

  // Extract USDT transfer details from transaction logs
  private extractUSDTTransferFromLogs(logs: any[]): { amount: string, to: string, from: string } | null {
    try {
      // USDT Transfer event signature: Transfer(address,address,uint256)
      const transferEventSignature = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
      
      for (const log of logs) {
        if (log.topics && log.topics[0] === transferEventSignature && log.topics.length >= 3) {
          // Decode the transfer event
          const fromAddress = '0x' + log.topics[1].slice(26); // Remove padding
          const toAddress = '0x' + log.topics[2].slice(26); // Remove padding
          const amount = this.web3.utils.fromWei(log.data, 'ether'); // Convert from wei to USDT
          
          console.log(`Transfer event found: ${amount} USDT from ${fromAddress} to ${toAddress}`);
          
          // Validate deposit amount limits
          const depositAmount = parseFloat(amount)
          if (depositAmount < 10) {
            throw new Error(`Minimum deposit amount is $10 USDT. Transaction amount: $${amount} USDT`)
          }
          
          if (depositAmount > 50000) {
            throw new Error(`Maximum deposit amount is $50,000 USDT. Transaction amount: $${amount} USDT`)
          }
          
          return {
            amount: amount,
            to: toAddress,
            from: fromAddress
          };
        }
      }
      
      console.log('No USDT transfer event found in transaction logs');
      return null;
    } catch (error) {
      console.error('Error extracting USDT transfer from logs:', error);
      throw error;
    }
  }

  // Get USDT balance of an address
  async getUSDTBalance(address: string): Promise<string> {
    try {
      const balance = await this.usdtContract.methods.balanceOf(address).call() as string;
      return this.web3.utils.fromWei(balance, 'ether');
    } catch (error) {
      console.error('Error getting USDT balance:', error);
      throw error;
    }
  }

  // Get BNB balance of an address
  async getBNBBalance(address: string): Promise<string> {
    try {
      const balance = await this.web3.eth.getBalance(address);
      return this.web3.utils.fromWei(balance, 'ether');
    } catch (error) {
      console.error('Error getting BNB balance:', error);
      throw error;
    }
  }

  // Transfer USDT tokens
  async transferUSDT(fromPrivateKey: string, toAddress: string, amount: string): Promise<string> {
    try {
      const fromAccount = this.web3.eth.accounts.privateKeyToAccount(fromPrivateKey);
      const amountWei = this.web3.utils.toWei(amount, 'ether');
      
      const transferTx = this.usdtContract.methods.transfer(toAddress, amountWei);
      const gasEstimate = await transferTx.estimateGas({ from: fromAccount.address });
      const gasPrice = await this.web3.eth.getGasPrice();
      const nonce = await this.web3.eth.getTransactionCount(fromAccount.address, 'pending');
      
      const txData = {
        from: fromAccount.address,
        to: this.config.usdtContractAddress,
        data: transferTx.encodeABI(),
        gas: gasEstimate.toString(),
        gasPrice: gasPrice.toString(),
        nonce: Number(nonce)
      };
      
      const signedTx = await fromAccount.signTransaction(txData);
      const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction as string);
      
      console.log(`USDT transfer successful: ${amount} USDT to ${toAddress}`);
      return receipt.transactionHash.toString();
    } catch (error) {
      console.error('Error transferring USDT:', error);
      throw error;
    }
  }

  // Send BNB for gas fees to user wallet
  async sendBNBForGas(toAddress: string, amount: string): Promise<string> {
    try {
      console.log(`Sending ${amount} BNB for gas to ${toAddress}`);
      
      const adminPrivateKey = this.config.privateKey.startsWith('0x') ? this.config.privateKey : `0x${this.config.privateKey}`;
      const fromAccount = this.web3.eth.accounts.privateKeyToAccount(adminPrivateKey);
      
      const amountWei = this.web3.utils.toWei(amount, 'ether');
      const gasPrice = await this.web3.eth.getGasPrice();
      const nonce = await this.web3.eth.getTransactionCount(fromAccount.address, 'pending');
      
      const txData = {
        from: fromAccount.address,
        to: toAddress,
        value: amountWei,
        gas: '21000', // Standard gas limit for BNB transfer
        gasPrice: gasPrice.toString(),
        nonce: Number(nonce)
      };
      
      const signedTx = await fromAccount.signTransaction(txData);
      const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction as string);
      
      console.log(`BNB transfer successful: ${amount} BNB to ${toAddress}`);
      return receipt.transactionHash.toString();
    } catch (error) {
      console.error('Error sending BNB for gas:', error);
      throw error;
    }
  }

  // Scan all user wallets and collect tokens (admin function)
  async scanAndCollectFromUserWallets(userIds: string[]): Promise<{
    scannedWallets: number,
    usdtCollections: Array<{userId: string, address: string, amount: string, txHash: string}>,
    bnbCollections: Array<{userId: string, address: string, amount: string, txHash: string}>,
    errors: Array<{userId: string, address: string, error: string}>
  }> {
    console.log(`Starting collection scan for ${userIds.length} user wallets`);
    
    const results = {
      scannedWallets: 0,
      usdtCollections: [] as Array<{userId: string, address: string, amount: string, txHash: string}>,
      bnbCollections: [] as Array<{userId: string, address: string, amount: string, txHash: string}>,
      errors: [] as Array<{userId: string, address: string, error: string}>
    };

    for (const userId of userIds) {
      try {
        const userWallet = this.generateUserWallet(userId);
        results.scannedWallets++;
        
        // Check USDT balance
        const usdtBalance = await this.getUSDTBalance(userWallet.address);
        const usdtBalanceNum = parseFloat(usdtBalance);
        
        if (usdtBalanceNum > 0.01) { // Collect if more than 0.01 USDT
          try {
            // Ensure user has BNB for gas
            const bnbBalance = await this.getBNBBalance(userWallet.address);
            if (parseFloat(bnbBalance) < 0.001) {
              await this.sendBNBForGas(userWallet.address, '0.002');
              await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for confirmation
            }
            
            const txHash = await this.transferUSDT(
              userWallet.privateKey,
              this.config.globalAdminWallet || this.config.adminFeeWallet || '',
              usdtBalance
            );
            
            results.usdtCollections.push({
              userId,
              address: userWallet.address,
              amount: usdtBalance,
              txHash
            });
          } catch (usdtError: any) {
            results.errors.push({
              userId,
              address: userWallet.address,
              error: `USDT collection failed: ${usdtError.message}`
            });
          }
        }
        
        // Check and collect BNB (after USDT collection)
        const bnbRecoveryTx = await this.recoverBNBFromUserWallet(userWallet.privateKey, userWallet.address);
        if (bnbRecoveryTx) {
          const bnbBalance = await this.getBNBBalance(userWallet.address);
          results.bnbCollections.push({
            userId,
            address: userWallet.address,
            amount: bnbBalance,
            txHash: bnbRecoveryTx
          });
        }
        
      } catch (error: any) {
        const userWallet = this.generateUserWallet(userId);
        results.errors.push({
          userId,
          address: userWallet.address,
          error: `Wallet scan failed: ${error.message}`
        });
      }
    }
    
    console.log(`Collection scan completed: ${results.usdtCollections.length} USDT, ${results.bnbCollections.length} BNB, ${results.errors.length} errors`);
    return results;
  }

  // Collect USDT from specific user wallet (admin function)
  async collectUSDTFromUserWallet(userId: string): Promise<{success: boolean, txHash?: string, amount?: string, error?: string}> {
    try {
      const userWallet = this.generateUserWallet(userId);
      const usdtBalance = await this.getUSDTBalance(userWallet.address);
      const usdtBalanceNum = parseFloat(usdtBalance);
      
      if (usdtBalanceNum <= 0.01) {
        return { success: false, error: 'Insufficient USDT balance to collect' };
      }
      
      // Ensure user has BNB for gas
      const bnbBalance = await this.getBNBBalance(userWallet.address);
      if (parseFloat(bnbBalance) < 0.001) {
        await this.sendBNBForGas(userWallet.address, '0.002');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      const txHash = await this.transferUSDT(
        userWallet.privateKey,
        this.config.globalAdminWallet || this.config.adminFeeWallet || '',
        usdtBalance
      );
      
      return { success: true, txHash, amount: usdtBalance };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Collect BNB from specific user wallet (admin function)
  async collectBNBFromUserWallet(userId: string): Promise<{success: boolean, txHash?: string, amount?: string, error?: string}> {
    try {
      const userWallet = this.generateUserWallet(userId);
      const bnbRecoveryTx = await this.recoverBNBFromUserWallet(userWallet.privateKey, userWallet.address);
      
      if (!bnbRecoveryTx) {
        return { success: false, error: 'No BNB to collect or amount too small' };
      }
      
      const bnbBalance = await this.getBNBBalance(userWallet.address);
      return { success: true, txHash: bnbRecoveryTx, amount: bnbBalance };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Recover remaining BNB from user wallet back to global admin wallet
  async recoverBNBFromUserWallet(userPrivateKey: string, userAddress: string): Promise<string | null> {
    try {
      console.log(`Recovering BNB from user wallet: ${userAddress}`);
      
      if (!this.config.globalAdminWallet) {
        throw new Error('GLOBAL_ADMIN_WALLET not configured for BNB recovery');
      }
      
      // Check current BNB balance in user wallet
      const currentBalance = await this.getBNBBalance(userAddress);
      const currentBalanceNum = parseFloat(currentBalance);
      
      // Only recover if there's a meaningful amount (more than gas cost)
      const gasPrice = await this.web3.eth.getGasPrice();
      const gasCost = parseFloat(this.web3.utils.fromWei((BigInt(gasPrice) * BigInt(21000)).toString(), 'ether'));
      const minRecoveryAmount = gasCost * 1.1; // 10% buffer above gas cost
      
      if (currentBalanceNum <= minRecoveryAmount) {
        console.log(`BNB balance too low to recover: ${currentBalanceNum} BNB (min: ${minRecoveryAmount} BNB)`);
        return null;
      }
      
      // Calculate amount to recover (leave small amount for potential future gas)
      const amountToRecover = currentBalanceNum - gasCost;
      const amountToRecoverWei = this.web3.utils.toWei(amountToRecover.toString(), 'ether');
      
      console.log(`Recovering ${amountToRecover} BNB from ${userAddress} to ${this.config.globalAdminWallet}`);
      
      const userAccount = this.web3.eth.accounts.privateKeyToAccount(userPrivateKey);
      const nonce = await this.web3.eth.getTransactionCount(userAddress, 'pending');
      
      const txData = {
        from: userAddress,
        to: this.config.globalAdminWallet,
        value: amountToRecoverWei,
        gas: '21000',
        gasPrice: gasPrice.toString(),
        nonce: Number(nonce)
      };
      
      const signedTx = await userAccount.signTransaction(txData);
      const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction as string);
      
      console.log(`BNB recovery successful: ${amountToRecover} BNB recovered to global admin wallet`);
      return receipt.transactionHash.toString();
    } catch (error) {
      console.error('Error recovering BNB from user wallet:', error);
      // Don't throw error - BNB recovery is optional and shouldn't fail the main process
      return null;
    }
  }

  // Transfer USDT from user wallet to admin wallets after deposit
  async transferToAdminWallets(userId: string, depositAmount: number, feeAmount: number): Promise<{feeTransferTx?: string, mainTransferTx?: string, gasTransferTx?: string, bnbRecoveryTx?: string}> {
    try {
      console.log(`Transferring USDT to admin wallets - Deposit: ${depositAmount}, Fee: ${feeAmount}`);
      
      const userWallet = this.generateUserWallet(userId);
      const userPrivateKey = userWallet.privateKey;
      
      // Check user wallet balances first
      const [userUsdtBalance, userBnbBalance] = await Promise.all([
        this.getUSDTBalance(userWallet.address),
        this.getBNBBalance(userWallet.address)
      ]);
      
      const userUsdtBalanceNum = parseFloat(userUsdtBalance);
      const userBnbBalanceNum = parseFloat(userBnbBalance);
      
      if (userUsdtBalanceNum < depositAmount) {
        throw new Error(`Insufficient USDT balance in user wallet. Required: ${depositAmount}, Available: ${userUsdtBalanceNum}`);
      }
      
      const results: {feeTransferTx?: string, mainTransferTx?: string, gasTransferTx?: string, bnbRecoveryTx?: string} = {};
      
      // Check if user has enough BNB for gas fees (estimate ~0.001 BNB per transaction)
      const estimatedGasNeeded = 0.002; // Conservative estimate for 2 transactions
      if (userBnbBalanceNum < estimatedGasNeeded) {
        console.log(`User wallet needs BNB for gas. Sending ${estimatedGasNeeded} BNB...`);
        try {
          results.gasTransferTx = await this.sendBNBForGas(userWallet.address, estimatedGasNeeded.toString());
          console.log(`Gas BNB sent successfully: ${results.gasTransferTx}`);
          
          // Wait a moment for the transaction to be confirmed
          await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (gasError: any) {
          console.error('Failed to send BNB for gas:', gasError);
          throw new Error(`Failed to send BNB for gas fees: ${gasError.message || 'Unknown error'}`);
        }
      }
      
      // Transfer fee to ADMIN_FEE_WALLET if configured
      if (this.config.adminFeeWallet && feeAmount > 0) {
        console.log(`Transferring fee ${feeAmount} USDT to admin fee wallet: ${this.config.adminFeeWallet}`);
        results.feeTransferTx = await this.transferUSDT(
          userPrivateKey,
          this.config.adminFeeWallet,
          feeAmount.toString()
        );
      }
      
      // Transfer remaining amount to GLOBAL_ADMIN_WALLET if configured
      const remainingAmount = depositAmount - feeAmount;
      if (this.config.globalAdminWallet && remainingAmount > 0) {
        console.log(`Transferring remaining ${remainingAmount} USDT to global admin wallet: ${this.config.globalAdminWallet}`);
        results.mainTransferTx = await this.transferUSDT(
          userPrivateKey,
          this.config.globalAdminWallet,
          remainingAmount.toString()
        );
      }
      
      // Recover BNB from user wallet after USDT transfers (if BNB was sent for gas)
      if (results.gasTransferTx) {
        console.log('Attempting to recover BNB from user wallet...');
        try {
          // Wait a moment for USDT transactions to be confirmed before BNB recovery
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          const bnbRecoveryTx = await this.recoverBNBFromUserWallet(userPrivateKey, userWallet.address);
          if (bnbRecoveryTx) {
            results.bnbRecoveryTx = bnbRecoveryTx;
            console.log(`BNB recovery completed: ${bnbRecoveryTx}`);
          } else {
            console.log('BNB recovery skipped - insufficient balance or not cost-effective');
          }
        } catch (bnbRecoveryError) {
          console.error('BNB recovery failed (non-critical):', bnbRecoveryError);
          // Don't fail the main process if BNB recovery fails
        }
      }
      
      console.log('USDT transfer to admin wallets completed successfully');
      return results;
    } catch (error) {
      console.error('Error transferring USDT to admin wallets:', error);
      throw error;
    }
  }

  // Process withdrawal with fee handling - transfers net amount to user and fee to admin fee wallet
  async processWithdrawalWithFee(userWalletAddress: string, totalAmount: number, feeAmount: number): Promise<{userTransferTx: string, feeTransferTx?: string}> {
    try {
      const netAmount = totalAmount - feeAmount;
      console.log(`Processing withdrawal with fee: Total: ${totalAmount}, Fee: ${feeAmount}, Net: ${netAmount}`);
      
      if (!this.config.globalAdminWallet) {
        throw new Error('GLOBAL_ADMIN_WALLET not configured');
      }
      
      // Check global admin wallet balance before withdrawal
      const globalWalletBalance = await this.getUSDTBalance(this.config.globalAdminWallet);
      const globalBalanceNum = parseFloat(globalWalletBalance);
      
      if (globalBalanceNum < netAmount) {
        throw new Error(`Insufficient USDT in global admin wallet for withdrawal. Required: ${netAmount}, Available: ${globalBalanceNum}`);
      }
      
      console.log(`Global admin wallet balance: ${globalBalanceNum} USDT, withdrawing: ${netAmount} USDT to user`);
      
      // Use admin private key to send from global admin wallet
      const adminPrivateKey = this.config.privateKey.startsWith('0x') ? this.config.privateKey : `0x${this.config.privateKey}`;
      
      // Verify that the private key corresponds to the global admin wallet
      const adminAccount = this.web3.eth.accounts.privateKeyToAccount(adminPrivateKey);
      if (adminAccount.address.toLowerCase() !== this.config.globalAdminWallet.toLowerCase()) {
        throw new Error(`Private key does not match global admin wallet. Expected: ${this.config.globalAdminWallet}, Got: ${adminAccount.address}`);
      }
      
      // Transfer net amount to user
      const userTransferTx = await this.transferUSDT(
        adminPrivateKey,
        userWalletAddress,
        netAmount.toString()
      );
      
      const result: {userTransferTx: string, feeTransferTx?: string} = { userTransferTx };
      
      // Transfer fee to ADMIN_FEE_WALLET if configured and fee > 0
      if (this.config.adminFeeWallet && feeAmount > 0) {
        try {
          console.log(`Transferring withdrawal fee ${feeAmount} USDT to admin fee wallet: ${this.config.adminFeeWallet}`);
          result.feeTransferTx = await this.transferUSDT(
            adminPrivateKey,
            this.config.adminFeeWallet,
            feeAmount.toString()
          );
          console.log(`Withdrawal fee transfer completed: ${result.feeTransferTx}`);
        } catch (feeError) {
          console.error('Failed to transfer withdrawal fee (non-critical):', feeError);
          // Don't fail the withdrawal if fee transfer fails
        }
      }
      
      console.log(`Withdrawal completed successfully - User: ${userTransferTx}, Fee: ${result.feeTransferTx || 'N/A'}`);
      return result;
    } catch (error) {
      console.error('Error processing withdrawal with fee:', error);
      throw error;
    }
  }

  // Process withdrawal by transferring USDT from global admin wallet to user (legacy method)
  async processWithdrawal(userWalletAddress: string, amount: string): Promise<string> {
    try {
      console.log(`Processing withdrawal: ${amount} USDT from global admin wallet to ${userWalletAddress}`);
      
      if (!this.config.globalAdminWallet) {
        throw new Error('GLOBAL_ADMIN_WALLET not configured');
      }
      
      // Check global admin wallet balance before withdrawal
      const globalWalletBalance = await this.getUSDTBalance(this.config.globalAdminWallet);
      const globalBalanceNum = parseFloat(globalWalletBalance);
      const withdrawalAmount = parseFloat(amount);
      
      if (globalBalanceNum < withdrawalAmount) {
        throw new Error(`Insufficient USDT in global admin wallet. Required: ${withdrawalAmount}, Available: ${globalBalanceNum}`);
      }
      
      console.log(`Global admin wallet balance: ${globalBalanceNum} USDT, withdrawing: ${withdrawalAmount} USDT`);
      
      // Use admin private key to send from global admin wallet
      // Note: The BSC_PRIVATE_KEY should correspond to the GLOBAL_ADMIN_WALLET address
      const adminPrivateKey = this.config.privateKey.startsWith('0x') ? this.config.privateKey : `0x${this.config.privateKey}`;
      
      // Verify that the private key corresponds to the global admin wallet
      const adminAccount = this.web3.eth.accounts.privateKeyToAccount(adminPrivateKey);
      if (adminAccount.address.toLowerCase() !== this.config.globalAdminWallet.toLowerCase()) {
        throw new Error(`Private key does not match global admin wallet. Expected: ${this.config.globalAdminWallet}, Got: ${adminAccount.address}`);
      }
      
      const txHash = await this.transferUSDT(
        adminPrivateKey,
        userWalletAddress,
        amount
      );
      
      console.log(`Withdrawal completed successfully: ${txHash}`);
      return txHash;
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      throw error;
    }
  }
}

export default BSCService;
