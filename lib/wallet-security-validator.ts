// Wallet Security Validator - Prevents funds from being sent to random/invalid addresses
import Web3 from 'web3';

interface WalletConfig {
  adminFeeWallet: string;
  globalAdminWallet: string;
  privateKey: string;
  walletSeed?: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  safeDestination?: string;
}

export class WalletSecurityValidator {
  private web3: Web3;

  constructor() {
    this.web3 = new Web3();
  }

  /**
   * Validates wallet configuration and prevents transfers to invalid addresses
   */
  validateWalletConfig(config: WalletConfig): ValidationResult {
    const result: ValidationResult = {
      isValid: false,
      errors: [],
      warnings: []
    };

    // Check if any admin wallet is configured
    if (!config.globalAdminWallet && !config.adminFeeWallet) {
      result.errors.push("CRITICAL: No admin wallets configured. Transfers will fail or go to 0x0 address!");
      return result;
    }

    // Validate global admin wallet
    if (config.globalAdminWallet) {
      const globalValidation = this.validateAddress(config.globalAdminWallet, "Global Admin Wallet");
      if (!globalValidation.isValid) {
        result.errors.push(...globalValidation.errors);
      } else {
        result.safeDestination = config.globalAdminWallet;
      }
    }

    // Validate admin fee wallet
    if (config.adminFeeWallet) {
      const feeValidation = this.validateAddress(config.adminFeeWallet, "Admin Fee Wallet");
      if (!feeValidation.isValid) {
        result.errors.push(...feeValidation.errors);
      } else if (!result.safeDestination) {
        result.safeDestination = config.adminFeeWallet;
      }
    }

    // Validate private key
    if (!config.privateKey) {
      result.errors.push("CRITICAL: No private key configured. Cannot sign transactions!");
    } else {
      const keyValidation = this.validatePrivateKey(config.privateKey);
      if (!keyValidation.isValid) {
        result.errors.push(...keyValidation.errors);
      }
    }

    // Check if private key matches admin wallets
    if (config.privateKey && result.safeDestination) {
      const keyMatchValidation = this.validatePrivateKeyMatch(config.privateKey, result.safeDestination);
      if (!keyMatchValidation.isValid) {
        result.errors.push(...keyMatchValidation.errors);
      }
    }

    // Warnings
    if (config.walletSeed === 'jarvis-ai-seed' || !config.walletSeed) {
      result.warnings.push("Using default wallet seed. Consider using a custom secure seed.");
    }

    result.isValid = result.errors.length === 0 && !!result.safeDestination;
    return result;
  }

  /**
   * Validates a wallet address format and security
   */
  private validateAddress(address: string, name: string): ValidationResult {
    const result: ValidationResult = {
      isValid: false,
      errors: [],
      warnings: []
    };

    if (!address || typeof address !== 'string') {
      result.errors.push(`${name}: Address is empty or invalid type`);
      return result;
    }

    const cleanAddress = address.trim();

    // Check format
    if (!cleanAddress.startsWith('0x')) {
      result.errors.push(`${name}: Address must start with 0x`);
      return result;
    }

    if (cleanAddress.length !== 42) {
      result.errors.push(`${name}: Address must be exactly 42 characters (got ${cleanAddress.length})`);
      return result;
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(cleanAddress)) {
      result.errors.push(`${name}: Address contains invalid characters (must be hexadecimal)`);
      return result;
    }

    // Check for common dangerous addresses
    const dangerousAddresses = [
      '0x0000000000000000000000000000000000000000', // Zero address
      '0x000000000000000000000000000000000000dead', // Dead address
      '0x0000000000000000000000000000000000000001', // Common test address
    ];

    if (dangerousAddresses.includes(cleanAddress.toLowerCase())) {
      result.errors.push(`${name}: Address is a known dangerous/burn address`);
      return result;
    }

    // Use Web3 validation if available
    try {
      if (!this.web3.utils.isAddress(cleanAddress)) {
        result.errors.push(`${name}: Address failed Web3 validation`);
        return result;
      }
    } catch (error) {
      result.warnings.push(`${name}: Could not perform Web3 validation`);
    }

    result.isValid = true;
    return result;
  }

  /**
   * Validates private key format
   */
  private validatePrivateKey(privateKey: string): ValidationResult {
    const result: ValidationResult = {
      isValid: false,
      errors: [],
      warnings: []
    };

    if (!privateKey || typeof privateKey !== 'string') {
      result.errors.push("Private key is empty or invalid type");
      return result;
    }

    const cleanKey = privateKey.trim();
    let keyToValidate = cleanKey;

    // Add 0x prefix if missing
    if (!cleanKey.startsWith('0x')) {
      keyToValidate = '0x' + cleanKey;
    }

    // Check length
    if (keyToValidate.length !== 66) {
      result.errors.push(`Private key must be 64 hex characters (got ${keyToValidate.length - 2})`);
      return result;
    }

    // Check format
    if (!/^0x[a-fA-F0-9]{64}$/.test(keyToValidate)) {
      result.errors.push("Private key contains invalid characters (must be hexadecimal)");
      return result;
    }

    // Check for obviously weak keys
    const weakKeys = [
      '0x0000000000000000000000000000000000000000000000000000000000000001',
      '0x1111111111111111111111111111111111111111111111111111111111111111',
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    ];

    if (weakKeys.includes(keyToValidate.toLowerCase())) {
      result.errors.push("Private key appears to be a weak/test key");
      return result;
    }

    result.isValid = true;
    return result;
  }

  /**
   * Validates that private key corresponds to the expected wallet address
   */
  private validatePrivateKeyMatch(privateKey: string, expectedAddress: string): ValidationResult {
    const result: ValidationResult = {
      isValid: false,
      errors: [],
      warnings: []
    };

    try {
      const cleanKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
      const account = this.web3.eth.accounts.privateKeyToAccount(cleanKey);
      
      if (account.address.toLowerCase() !== expectedAddress.toLowerCase()) {
        result.errors.push(
          `Private key mismatch! Key generates ${account.address} but expected ${expectedAddress}. ` +
          `This means transfers will fail or funds could be sent to wrong address!`
        );
        return result;
      }

      result.isValid = true;
    } catch (error: any) {
      result.errors.push(`Failed to validate private key match: ${error.message}`);
    }

    return result;
  }

  /**
   * Gets the safe destination address for transfers
   */
  getSafeDestination(config: WalletConfig): string | null {
    const validation = this.validateWalletConfig(config);
    return validation.safeDestination || null;
  }

  /**
   * Validates a transfer before execution
   */
  validateTransfer(
    fromAddress: string,
    toAddress: string,
    amount: string,
    config: WalletConfig
  ): ValidationResult {
    const result: ValidationResult = {
      isValid: false,
      errors: [],
      warnings: []
    };

    // Validate destination address
    const destValidation = this.validateAddress(toAddress, "Transfer Destination");
    if (!destValidation.isValid) {
      result.errors.push(...destValidation.errors);
    }

    // Validate config
    const configValidation = this.validateWalletConfig(config);
    if (!configValidation.isValid) {
      result.errors.push(...configValidation.errors);
    }

    // Check if destination matches expected admin wallets
    const isValidDestination = 
      toAddress.toLowerCase() === config.globalAdminWallet?.toLowerCase() ||
      toAddress.toLowerCase() === config.adminFeeWallet?.toLowerCase();

    if (!isValidDestination) {
      result.errors.push(
        `SECURITY ALERT: Transfer destination ${toAddress} does not match configured admin wallets! ` +
        `This could be an attempt to send funds to unauthorized address.`
      );
    }

    // Validate amount
    try {
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        result.errors.push("Transfer amount must be a positive number");
      }
    } catch (error) {
      result.errors.push("Invalid transfer amount format");
    }

    result.isValid = result.errors.length === 0;
    return result;
  }
}

export default WalletSecurityValidator;
