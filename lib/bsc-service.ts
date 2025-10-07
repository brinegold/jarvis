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
          
          // Validate minimum amount
          if (parseFloat(amount) < 1) {
            throw new Error(`Minimum deposit amount is 1 USDT. Transaction amount: ${amount} USDT`);
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

  // Process withdrawal by transferring USDT from admin wallet to user
  async processWithdrawal(userWalletAddress: string, amount: string): Promise<string> {
    try {
      console.log(`Processing withdrawal: ${amount} USDT to ${userWalletAddress}`);
      
      const adminPrivateKey = this.config.privateKey.startsWith('0x') ? this.config.privateKey : `0x${this.config.privateKey}`;
      
      const txHash = await this.transferUSDT(
        adminPrivateKey,
        userWalletAddress,
        amount
      );
      
      return txHash;
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      throw error;
    }
  }
}

export default BSCService;
