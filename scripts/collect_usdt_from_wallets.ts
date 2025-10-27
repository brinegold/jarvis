import { createClient, SupabaseClient } from '@supabase/supabase-js';
import BSCService from '../lib/bsc-service';
import fs from 'fs';

// Set WALLET_SEED if not already set
if (!process.env.WALLET_SEED) {
  process.env.WALLET_SEED = 'very_good_seed';
}

// Supabase client - initialized only when needed
let supabase: SupabaseClient | null = null;

// Function to initialize Supabase (only when needed)
function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    const supabaseUrl = 'https://cjusrfbhetqasklhhffx.supabase.co';
    const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqdXNyZmJoZXRxYXNrbGhoZmZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MDAzMTMsImV4cCI6MjA3NDk3NjMxM30.NUrARekZ2jma-w_wLoscVuGih0sUunfZEhhdGtlIDXI';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials required for this operation. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    }
    
    supabase = createClient(supabaseUrl, supabaseServiceKey);
  }
  return supabase;
}

// Initialize BSC Service
const bscService = new BSCService({
  rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org/',
  contractAddress: process.env.PAYMENT_PROCESSOR_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000',
  usdtContractAddress: process.env.USDT_CONTRACT_ADDRESS || '0x55d398326f99059fF775485246999027B3197955',
  adminFeeWallet: process.env.ADMIN_FEE_WALLET || "0xB33dDC237F80524b1810824bE24C1b5899E23c4a",
  globalAdminWallet: process.env.GLOBAL_ADMIN_WALLET || "0xB33dDC237F80524b1810824bE24C1b5899E23c4a",
  privateKey: process.env.ADMIN_PRIVATE_KEY || "fb9a68b28eac638924ebb365449cfd49733c25db70aca07de7280b69524ca353"
});

interface CollectionResult {
  userId: string;
  walletAddress: string;
  success: boolean;
  txHash?: string;
  amount?: string;
  error?: string;
  timestamp: string;
}

interface CollectionSummary {
  totalWallets: number;
  successfulCollections: number;
  failedCollections: number;
  totalUSDTCollected: number;
  results: CollectionResult[];
  startTime: string;
  endTime: string;
}

/**
 * Collect USDT from a single user wallet by user ID
 */
async function collectFromWallet(userId: string): Promise<CollectionResult> {
  const timestamp = new Date().toISOString();
  
  try {
    console.log(`\n📊 Processing user: ${userId}`);
    
    // Generate wallet address for this user
    const userWallet = (bscService as any).generateUserWallet(userId);
    console.log(`   Wallet: ${userWallet.address}`);
    
    // Check USDT balance first
    const balance = await bscService.getUSDTBalance(userWallet.address);
    const balanceNum = parseFloat(balance);
    
    console.log(`   USDT Balance: ${balanceNum.toFixed(6)} USDT`);
    
    if (balanceNum <= 0.01) {
      console.log(`   ⚠️ Insufficient balance (< 0.01 USDT), skipping...`);
      return {
        userId,
        walletAddress: userWallet.address,
        success: false,
        error: 'Insufficient balance',
        timestamp
      };
    }
    
    // Collect USDT from this wallet
    console.log(`   🔄 Collecting USDT...`);
    const result = await bscService.collectUSDTFromUserWallet(userId);
    
    if (result.success) {
      console.log(`   ✅ Success! TX: ${result.txHash}`);
      console.log(`   💰 Collected: ${result.amount} USDT`);
      
      return {
        userId,
        walletAddress: userWallet.address,
        success: true,
        txHash: result.txHash,
        amount: result.amount,
        timestamp
      };
    } else {
      console.log(`   ❌ Failed: ${result.error}`);
      return {
        userId,
        walletAddress: userWallet.address,
        success: false,
        error: result.error,
        timestamp
      };
    }
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
    return {
      userId,
      walletAddress: 'unknown',
      success: false,
      error: error.message,
      timestamp
    };
  }
}

/**
 * Collect USDT directly from wallet address (generates private key from address lookup)
 */
async function collectFromWalletDirect(walletAddress: string, userId?: string): Promise<CollectionResult> {
  const timestamp = new Date().toISOString();
  const displayId = userId || walletAddress.substring(0, 10) + '...';
  
  try {
    console.log(`\n📊 Processing wallet: ${walletAddress}`);
    
    // If we don't have userId, we need to find it by generating wallets
    let userWallet: { address: string; privateKey: string };
    
    if (!userId) {
      console.log(`   🔍 Looking up user ID for wallet...`);
      // This requires Supabase to find the user
      throw new Error('Direct wallet collection without user ID not yet implemented. Use --addresses to look up user IDs first.');
    } else {
      userWallet = (bscService as any).generateUserWallet(userId);
    }
    
    // Check USDT balance first
    const balance = await bscService.getUSDTBalance(walletAddress);
    const balanceNum = parseFloat(balance);
    
    console.log(`   USDT Balance: ${balanceNum.toFixed(6)} USDT`);
    
    if (balanceNum <= 0.01) {
      console.log(`   ⚠️ Insufficient balance (< 0.01 USDT), skipping...`);
      return {
        userId: displayId,
        walletAddress,
        success: false,
        error: 'Insufficient balance',
        timestamp
      };
    }
    
    // Collect USDT from this wallet using private key
    console.log(`   🔄 Collecting USDT...`);
    const result = await bscService.collectUSDTFromWalletWithKey(walletAddress, userWallet.privateKey);
    
    if (result.success) {
      console.log(`   ✅ Success! TX: ${result.txHash}`);
      console.log(`   💰 Collected: ${result.amount} USDT`);
      
      return {
        userId: displayId,
        walletAddress,
        success: true,
        txHash: result.txHash,
        amount: result.amount,
        timestamp
      };
    } else {
      console.log(`   ❌ Failed: ${result.error}`);
      return {
        userId: displayId,
        walletAddress,
        success: false,
        error: result.error,
        timestamp
      };
    }
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
    return {
      userId: displayId,
      walletAddress,
      success: false,
      error: error.message,
      timestamp
    };
  }
}

/**
 * Collect USDT from multiple wallets with rate limiting (by user ID)
 */
async function collectFromMultipleWallets(
  userIds: string[],
  delayBetweenCollections: number = 3000
): Promise<CollectionSummary> {
  const startTime = new Date().toISOString();
  const results: CollectionResult[] = [];
  
  console.log(`\n🚀 Starting USDT collection from ${userIds.length} wallets...`);
  console.log(`⏱️ Delay between collections: ${delayBetweenCollections}ms\n`);
  
  for (let i = 0; i < userIds.length; i++) {
    const userId = userIds[i];
    console.log(`\n[${i + 1}/${userIds.length}] Processing wallet for user: ${userId}`);
    
    const result = await collectFromWallet(userId);
    results.push(result);
    
    // Add delay between collections to avoid rate limiting
    if (i < userIds.length - 1) {
      console.log(`   ⏳ Waiting ${delayBetweenCollections}ms before next collection...`);
      await new Promise(resolve => setTimeout(resolve, delayBetweenCollections));
    }
  }
  
  const endTime = new Date().toISOString();
  
  // Calculate summary
  const successfulCollections = results.filter(r => r.success).length;
  const failedCollections = results.filter(r => !r.success).length;
  const totalUSDTCollected = results
    .filter(r => r.success && r.amount)
    .reduce((sum, r) => sum + parseFloat(r.amount!), 0);
  
  const summary: CollectionSummary = {
    totalWallets: userIds.length,
    successfulCollections,
    failedCollections,
    totalUSDTCollected,
    results,
    startTime,
    endTime
  };
  
  return summary;
}

/**
 * Collect USDT directly from wallet addresses (queries database for stored addresses)
 */
async function collectFromWalletAddresses(
  addresses: string[],
  delayBetweenCollections: number = 3000
): Promise<CollectionSummary> {
  const startTime = new Date().toISOString();
  const results: CollectionResult[] = [];
  
  console.log(`\n🚀 Starting USDT collection from ${addresses.length} wallet addresses...`);
  console.log(`⏱️ Delay between collections: ${delayBetweenCollections}ms\n`);
  console.log(`ℹ️ Looking up wallet addresses from database...\n`);
  
  // Query database for users with these wallet addresses
  const supabase = getSupabaseClient();
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, bsc_wallet_address')
    .in('bsc_wallet_address', addresses);
  
  if (error) {
    throw new Error(`Failed to fetch profiles: ${error.message}`);
  }
  
  if (!profiles || profiles.length === 0) {
    console.log(`⚠️ No users found with these wallet addresses in database`);
    console.log(`\nSearched for addresses:`);
    addresses.forEach(addr => console.log(`  - ${addr}`));
    
    // Return empty results
    return {
      totalWallets: addresses.length,
      successfulCollections: 0,
      failedCollections: addresses.length,
      totalUSDTCollected: 0,
      results: addresses.map(addr => ({
        userId: addr.substring(0, 10) + '...',
        walletAddress: addr,
        success: false,
        error: 'No user found with this wallet address in database',
        timestamp: new Date().toISOString()
      })),
      startTime,
      endTime: new Date().toISOString()
    };
  }
  
  console.log(`✅ Found ${profiles.length} users with matching wallet addresses\n`);
  
  // Create a map of address -> userId
  const addressToUserId: Map<string, string> = new Map();
  
  for (const profile of profiles) {
    if (profile.bsc_wallet_address) {
      addressToUserId.set(profile.bsc_wallet_address.toLowerCase(), profile.id);
      console.log(`✅ Matched ${profile.bsc_wallet_address} to user ${profile.id}`);
    }
  }
  
  console.log(`\n📊 Matched ${addressToUserId.size} out of ${addresses.length} addresses\n`);
  
  // Now collect from matched addresses
  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i].trim();
    const userId = addressToUserId.get(address.toLowerCase());
    
    console.log(`\n[${i + 1}/${addresses.length}] Processing wallet: ${address}`);
    
    if (!userId) {
      console.log(`   ⚠️ No user ID found for this address, skipping...`);
      results.push({
        userId: address.substring(0, 10) + '...',
        walletAddress: address,
        success: false,
        error: 'No matching user ID found',
        timestamp: new Date().toISOString()
      });
      continue;
    }
    
    const result = await collectFromWalletDirect(address, userId);
    results.push(result);
    
    // Add delay between collections to avoid rate limiting
    if (i < addresses.length - 1) {
      console.log(`   ⏳ Waiting ${delayBetweenCollections}ms before next collection...`);
      await new Promise(resolve => setTimeout(resolve, delayBetweenCollections));
    }
  }
  
  const endTime = new Date().toISOString();
  
  // Calculate summary
  const successfulCollections = results.filter(r => r.success).length;
  const failedCollections = results.filter(r => !r.success).length;
  const totalUSDTCollected = results
    .filter(r => r.success && r.amount)
    .reduce((sum, r) => sum + parseFloat(r.amount!), 0);
  
  const summary: CollectionSummary = {
    totalWallets: addresses.length,
    successfulCollections,
    failedCollections,
    totalUSDTCollected,
    results,
    startTime,
    endTime
  };
  
  return summary;
}

/**
 * Get all user IDs from database
 */
async function getAllUserIds(): Promise<string[]> {
  const supabase = getSupabaseClient();
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id')
    .order('created_at', { ascending: true });
  
  if (error) {
    throw new Error(`Failed to fetch user IDs: ${error.message}`);
  }
  
  return profiles.map(p => p.id);
}

/**
 * Get user IDs from wallet addresses
 */
async function getUserIdsFromAddresses(addresses: string[]): Promise<string[]> {
  console.log(`🔍 Looking up user IDs for ${addresses.length} wallet addresses...`);
  
  const userIds: string[] = [];
  
  // Get all users from database
  const supabase = getSupabaseClient();
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id')
    .limit(10000);
  
  if (!profiles) {
    throw new Error('Failed to fetch user profiles');
  }
  
  console.log(`📊 Checking ${profiles.length} users...`);
  
  // For each address, find the matching user ID
  for (const address of addresses) {
    const cleanAddress = address.trim().toLowerCase();
    let found = false;
    
    for (const profile of profiles) {
      const wallet = (bscService as any).generateUserWallet(profile.id);
      if (wallet.address.toLowerCase() === cleanAddress) {
        userIds.push(profile.id);
        console.log(`✅ Found user ${profile.id} for wallet ${address}`);
        found = true;
        break;
      }
    }
    
    if (!found) {
      console.log(`⚠️ No user found for wallet ${address}`);
    }
  }
  
  console.log(`\n📊 Matched ${userIds.length} user IDs from ${addresses.length} addresses\n`);
  return userIds;
}

/**
 * Get user IDs from JSON file with wallet addresses
 */
async function getUserIdsFromAddressFile(filePath: string): Promise<string[]> {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(fileContent);
    
    // Extract addresses from the file
    let addresses: string[] = [];
    
    if (Array.isArray(data)) {
      if (data.length > 0 && data[0].bsc_wallet_address) {
        addresses = data.map((item: any) => item.bsc_wallet_address);
      } else {
        addresses = data;
      }
    }
    
    console.log(`📁 Loaded ${addresses.length} addresses from file`);
    
    // For each address, find the corresponding user ID from database
    const userIds: string[] = [];
    
    for (const address of addresses) {
      // Query database to find user with this wallet address
      // Note: You'll need to match the wallet generation logic
      // This is a placeholder - adjust based on your actual user-wallet mapping
      const supabase = getSupabaseClient();
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .limit(1000);
      
      if (profiles) {
        for (const profile of profiles) {
          const wallet = (bscService as any).generateUserWallet(profile.id);
          if (wallet.address.toLowerCase() === address.toLowerCase()) {
            userIds.push(profile.id);
            console.log(`✅ Found user ${profile.id} for wallet ${address}`);
            break;
          }
        }
      }
    }
    
    console.log(`\n📊 Matched ${userIds.length} user IDs from ${addresses.length} addresses\n`);
    return userIds;
  } catch (error: any) {
    throw new Error(`Failed to read address file: ${error.message}`);
  }
}

/**
 * Print collection summary
 */
function printSummary(summary: CollectionSummary) {
  console.log('\n' + '='.repeat(80));
  console.log('📊 COLLECTION SUMMARY');
  console.log('='.repeat(80));
  console.log(`\n⏰ Start Time: ${summary.startTime}`);
  console.log(`⏰ End Time: ${summary.endTime}`);
  console.log(`\n📈 Total Wallets Processed: ${summary.totalWallets}`);
  console.log(`✅ Successful Collections: ${summary.successfulCollections}`);
  console.log(`❌ Failed Collections: ${summary.failedCollections}`);
  console.log(`💰 Total USDT Collected: ${summary.totalUSDTCollected.toFixed(6)} USDT`);
  
  console.log('\n📋 SUCCESSFUL COLLECTIONS:');
  const successful = summary.results.filter(r => r.success);
  if (successful.length > 0) {
    successful.forEach((r, i) => {
      console.log(`${i + 1}. User: ${r.userId}`);
      console.log(`   Wallet: ${r.walletAddress}`);
      console.log(`   Amount: ${r.amount} USDT`);
      console.log(`   TX: ${r.txHash}`);
    });
  } else {
    console.log('   None');
  }
  
  console.log('\n❌ FAILED COLLECTIONS:');
  const failed = summary.results.filter(r => !r.success);
  if (failed.length > 0) {
    failed.forEach((r, i) => {
      console.log(`${i + 1}. User: ${r.userId}`);
      console.log(`   Wallet: ${r.walletAddress}`);
      console.log(`   Error: ${r.error}`);
    });
  } else {
    console.log('   None');
  }
  
  console.log('\n' + '='.repeat(80));
}

/**
 * Save results to file
 */
function saveResults(summary: CollectionSummary) {
  const filename = `usdt_collection_${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(summary, null, 2));
  console.log(`\n💾 Results saved to: ${filename}`);
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log('🔐 USDT Collection Script');
    console.log('='.repeat(80));
    
    // Get user IDs based on command line arguments
    let userIds: string[];
    let needsSupabase = false;
    
    let summary: CollectionSummary;
    
    if (process.argv[2] === '--file' && process.argv[3]) {
      // Load from address file
      needsSupabase = true;
      console.log(`\n📁 Loading addresses from file: ${process.argv[3]}`);
      userIds = await getUserIdsFromAddressFile(process.argv[3]);
      
      if (userIds.length === 0) {
        console.log('\n⚠️ No users to process');
        process.exit(0);
      }
      
      console.log(`\n⚠️ WARNING: About to collect USDT from ${userIds.length} wallets`);
      console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      summary = await collectFromMultipleWallets(userIds, 3000);
      
    } else if (process.argv[2] === '--addresses' && process.argv[3]) {
      // Wallet addresses provided - collect directly
      needsSupabase = true;
      const addresses = process.argv[3].split(',').map(a => a.trim());
      console.log(`\n💰 Direct collection from ${addresses.length} wallet addresses`);
      
      console.log(`\n⚠️ WARNING: About to collect USDT from ${addresses.length} wallets`);
      console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      summary = await collectFromWalletAddresses(addresses, 3000);
      
    } else if (process.argv[2] === '--users' && process.argv[3]) {
      // Specific user IDs provided - no Supabase needed
      userIds = process.argv[3].split(',').map(u => u.trim());
      console.log(`\n👥 Processing ${userIds.length} specific users`);
      
      if (userIds.length === 0) {
        console.log('\n⚠️ No users to process');
        process.exit(0);
      }
      
      console.log(`\n⚠️ WARNING: About to collect USDT from ${userIds.length} wallets`);
      console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      summary = await collectFromMultipleWallets(userIds, 3000);
      
    } else if (process.argv[2] === '--all') {
      // All users from database
      needsSupabase = true;
      console.log(`\n👥 Loading all users from database...`);
      userIds = await getAllUserIds();
      console.log(`   Found ${userIds.length} users`);
      
      if (userIds.length === 0) {
        console.log('\n⚠️ No users to process');
        process.exit(0);
      }
      
      console.log(`\n⚠️ WARNING: About to collect USDT from ${userIds.length} wallets`);
      console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      summary = await collectFromMultipleWallets(userIds, 3000);
      
    } else {
      console.log('\n❌ Invalid arguments');
      console.log('\nUsage:');
      console.log('  npm run collect:usdt -- --file <path_to_addresses.json>');
      console.log('  npm run collect:usdt -- --addresses <address1,address2,address3>');
      console.log('  npm run collect:usdt -- --users <userId1,userId2,userId3>');
      console.log('  npm run collect:usdt -- --all');
      console.log('\nNote: --addresses, --file, and --all require Supabase credentials');
      console.log('      --users only requires BSC/wallet credentials');
      process.exit(1);
    }
    
    // Print and save results
    printSummary(summary);
    saveResults(summary);
    
    console.log('\n✅ Collection complete!');
    
  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

export { collectFromWallet, collectFromMultipleWallets, getAllUserIds };
