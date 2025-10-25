// Emergency wallet configuration checker
// Run this to verify your environment variables

const BSC_CONFIG = {
  rpcUrl: process.env.BSC_RPC_URL || "https://bsc-dataseed1.binance.org/",
  contractAddress: process.env.PAYMENT_CONTRACT_ADDRESS || "",
  usdtContractAddress: process.env.USDT_CONTRACT_ADDRESS || "0x55d398326f99059fF775485246999027B3197955",
  adminFeeWallet: process.env.ADMIN_FEE_WALLET || "",
  globalAdminWallet: process.env.GLOBAL_ADMIN_WALLET || "",
  privateKey: process.env.BSC_PRIVATE_KEY || "",
  walletSeed: process.env.WALLET_SEED || 'jarvis-ai-seed'
}

console.log("🔍 WALLET CONFIGURATION AUDIT");
console.log("================================");

console.log("\n📋 Environment Variables Status:");
console.log(`ADMIN_FEE_WALLET: ${BSC_CONFIG.adminFeeWallet ? '✅ SET' : '❌ MISSING'}`);
console.log(`GLOBAL_ADMIN_WALLET: ${BSC_CONFIG.globalAdminWallet ? '✅ SET' : '❌ MISSING'}`);
console.log(`BSC_PRIVATE_KEY: ${BSC_CONFIG.privateKey ? '✅ SET' : '❌ MISSING'}`);
console.log(`WALLET_SEED: ${BSC_CONFIG.walletSeed !== 'jarvis-ai-seed' ? '✅ CUSTOM' : '⚠️ DEFAULT'}`);

console.log("\n🎯 Transfer Destinations:");
if (BSC_CONFIG.globalAdminWallet) {
  console.log(`Primary (Global Admin): ${BSC_CONFIG.globalAdminWallet}`);
} else if (BSC_CONFIG.adminFeeWallet) {
  console.log(`Fallback (Fee Wallet): ${BSC_CONFIG.adminFeeWallet}`);
} else {
  console.log("❌ NO VALID DESTINATION - FUNDS WILL BE LOST!");
}

console.log("\n⚠️ SECURITY WARNINGS:");
if (!BSC_CONFIG.globalAdminWallet && !BSC_CONFIG.adminFeeWallet) {
  console.log("🚨 CRITICAL: No admin wallets configured - transfers will fail!");
}
if (BSC_CONFIG.walletSeed === 'jarvis-ai-seed') {
  console.log("⚠️ Using default wallet seed - consider using custom seed");
}
if (!BSC_CONFIG.privateKey) {
  console.log("🚨 CRITICAL: No private key configured - cannot sign transactions!");
}

// Validate wallet addresses
const validateAddress = (address, name) => {
  if (!address) return false;
  if (!address.startsWith('0x')) {
    console.log(`❌ ${name}: Invalid format (missing 0x prefix)`);
    return false;
  }
  if (address.length !== 42) {
    console.log(`❌ ${name}: Invalid length (should be 42 characters)`);
    return false;
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    console.log(`❌ ${name}: Invalid characters (not hex)`);
    return false;
  }
  console.log(`✅ ${name}: Valid format`);
  return true;
}

console.log("\n🔐 Address Validation:");
validateAddress(BSC_CONFIG.globalAdminWallet, "Global Admin Wallet");
validateAddress(BSC_CONFIG.adminFeeWallet, "Admin Fee Wallet");

console.log("\n================================");
console.log("Run this script to check your configuration before any transfers!");
