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
  totalBNBCollected: number;
  results: CollectionResult[];
  startTime: string;
  endTime: string;
}

/**
 * Collect BNB from a single user wallet by user ID
 */
async function collectBNBFromWallet(userId: string): Promise<CollectionResult> {
  const timestamp = new Date().toISOString();
  
  try {
    console.log(`\n📊 Processing user: ${userId}`);
    
    // Generate wallet address for this user
    const userWallet = (bscService as any).generateUserWallet(userId);
    console.log(`   Wallet: ${userWallet.address}`);
    
    // Check BNB balance first
    const balance = await bscService.getBNBBalance(userWallet.address);
    const balanceNum = parseFloat(balance);
    
    console.log(`   BNB Balance: ${balanceNum.toFixed(6)} BNB`);
    
    // Only collect if more than 0.005 BNB (to cover gas costs)
    if (balanceNum <= 0.005) {
      console.log(`   ⚠️ Insufficient balance (< 0.005 BNB), skipping...`);
      return {
        userId,
        walletAddress: userWallet.address,
        success: false,
        error: 'Insufficient balance (minimum 0.005 BNB required)',
        timestamp
      };
    }
    
    // Collect BNB from this wallet
    console.log(`   🔄 Collecting BNB...`);
    const result = await bscService.collectBNBFromUserWallet(userId);
    
    if (result.success) {
      console.log(`   ✅ Success! TX: ${result.txHash}`);
      console.log(`   💰 Collected: ${result.amount} BNB`);
      
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
 * Collect BNB directly from wallet address
 */
async function collectBNBFromWalletDirect(walletAddress: string, userId?: string): Promise<CollectionResult> {
  const timestamp = new Date().toISOString();
  const displayId = userId || walletAddress.substring(0, 10) + '...';
  
  try {
    console.log(`\n📊 Processing wallet: ${walletAddress}`);
    
    // If we don't have userId, throw error
    if (!userId) {
      throw new Error('User ID required for BNB collection');
    }
    
    const userWallet = (bscService as any).generateUserWallet(userId);
    
    // Check BNB balance first
    const balance = await bscService.getBNBBalance(walletAddress);
    const balanceNum = parseFloat(balance);
    
    console.log(`   BNB Balance: ${balanceNum.toFixed(6)} BNB`);
    
    if (balanceNum <= 0.005) {
      console.log(`   ⚠️ Insufficient balance (< 0.005 BNB), skipping...`);
      return {
        userId: displayId,
        walletAddress,
        success: false,
        error: 'Insufficient balance (minimum 0.005 BNB required)',
        timestamp
      };
    }
    
    // Collect BNB from this wallet using private key
    console.log(`   🔄 Collecting BNB...`);
    const result = await bscService.collectBNBFromWalletWithKey(walletAddress, userWallet.privateKey);
    
    if (result.success) {
      console.log(`   ✅ Success! TX: ${result.txHash}`);
      console.log(`   💰 Collected: ${result.amount} BNB`);
      
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
 * Collect BNB from multiple wallets with rate limiting (by user ID)
 */
async function collectFromMultipleWallets(
  userIds: string[],
  delayBetweenCollections: number = 3000
): Promise<CollectionSummary> {
  const startTime = new Date().toISOString();
  const results: CollectionResult[] = [];
  
  console.log(`\n🚀 Starting BNB collection from ${userIds.length} wallets...`);
  console.log(`⏱️ Delay between collections: ${delayBetweenCollections}ms\n`);
  
  for (let i = 0; i < userIds.length; i++) {
    const userId = userIds[i];
    console.log(`\n[${i + 1}/${userIds.length}] Processing wallet for user: ${userId}`);
    
    const result = await collectBNBFromWallet(userId);
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
  const totalBNBCollected = results
    .filter(r => r.success && r.amount)
    .reduce((sum, r) => sum + parseFloat(r.amount!), 0);
  
  const summary: CollectionSummary = {
    totalWallets: userIds.length,
    successfulCollections,
    failedCollections,
    totalBNBCollected,
    results,
    startTime,
    endTime
  };
  
  return summary;
}

/**
 * Collect BNB directly from wallet addresses (queries database for stored addresses)
 */
async function collectFromWalletAddresses(
  addresses: string[],
  delayBetweenCollections: number = 3000
): Promise<CollectionSummary> {
  const startTime = new Date().toISOString();
  const results: CollectionResult[] = [];
  
  console.log(`\n🚀 Starting BNB collection from ${addresses.length} wallet addresses...`);
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
      totalBNBCollected: 0,
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
    
    const result = await collectBNBFromWalletDirect(address, userId);
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
  const totalBNBCollected = results
    .filter(r => r.success && r.amount)
    .reduce((sum, r) => sum + parseFloat(r.amount!), 0);
  
  const summary: CollectionSummary = {
    totalWallets: addresses.length,
    successfulCollections,
    failedCollections,
    totalBNBCollected,
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
 * Print collection summary
 */
function printSummary(summary: CollectionSummary) {
  console.log('\n' + '='.repeat(80));
  console.log('📊 BNB COLLECTION SUMMARY');
  console.log('='.repeat(80));
  console.log(`\n⏰ Start Time: ${summary.startTime}`);
  console.log(`⏰ End Time: ${summary.endTime}`);
  console.log(`\n📈 Total Wallets Processed: ${summary.totalWallets}`);
  console.log(`✅ Successful Collections: ${summary.successfulCollections}`);
  console.log(`❌ Failed Collections: ${summary.failedCollections}`);
  console.log(`💰 Total BNB Collected: ${summary.totalBNBCollected.toFixed(6)} BNB`);
  
  if (summary.successfulCollections > 0) {
    console.log(`\n📋 SUCCESSFUL COLLECTIONS:`);
    summary.results
      .filter(r => r.success)
      .forEach((result, index) => {
        console.log(`${index + 1}. User: ${result.userId}`);
        console.log(`   Wallet: ${result.walletAddress}`);
        console.log(`   Amount: ${result.amount} BNB`);
        console.log(`   TX: ${result.txHash}`);
      });
  } else {
    console.log(`\n📋 SUCCESSFUL COLLECTIONS:\n   None`);
  }
  
  if (summary.failedCollections > 0) {
    console.log(`\n❌ FAILED COLLECTIONS:`);
    summary.results
      .filter(r => !r.success)
      .forEach((result, index) => {
        console.log(`${index + 1}. User: ${result.userId}`);
        console.log(`   Wallet: ${result.walletAddress}`);
        console.log(`   Error: ${result.error}`);
      });
  }
  
  console.log('\n' + '='.repeat(80));
}

/**
 * Save results to JSON file
 */
function saveResults(summary: CollectionSummary) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `bnb_collection_results_${timestamp}.json`;
  
  fs.writeFileSync(filename, JSON.stringify(summary, null, 2));
  console.log(`\n💾 Results saved to: ${filename}`);
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log('💎 BNB Collection Script');
    console.log('='.repeat(80));
    
    // Get user IDs based on command line arguments
    let userIds: string[];
    let needsSupabase = false;
    
    let summary: CollectionSummary;
    
    if (process.argv[2] === '--addresses' && process.argv[3]) {
      // Wallet addresses provided - collect directly
      needsSupabase = true;
      const addresses = process.argv[3].split(',').map(a => a.trim());
      console.log(`\n💰 Direct collection from ${addresses.length} wallet addresses`);
      
      console.log(`\n⚠️ WARNING: About to collect BNB from ${addresses.length} wallets`);
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
      
      console.log(`\n⚠️ WARNING: About to collect BNB from ${userIds.length} wallets`);
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
      
      console.log(`\n⚠️ WARNING: About to collect BNB from ${userIds.length} wallets`);
      console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      summary = await collectFromMultipleWallets(userIds, 3000);
      
    } else {
      console.log('\n❌ Invalid arguments');
      console.log('\nUsage:');
      console.log('  npm run collect:bnb -- --addresses <address1,address2,address3>');
      console.log('  npm run collect:bnb -- --users <userId1,userId2,userId3>');
      console.log('  npm run collect:bnb -- --all');
      console.log('\nNote: --addresses and --all require Supabase credentials');
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
main();
