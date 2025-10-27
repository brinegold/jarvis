const axios = require('axios');
const fs = require('fs');

// BSC RPC endpoint configuration (using direct RPC instead of deprecated BSCScan API)
const BSC_RPC_URLS = [
  'https://bsc-dataseed1.binance.org',
  'https://bsc-dataseed2.binance.org',
  'https://bsc-dataseed3.binance.org',
  'https://bsc-dataseed4.binance.org',
  'https://rpc.ankr.com/bsc',
  'https://bsc.publicnode.com'
];

let currentRpcIndex = 0;

/**
 * Check BNB balance for a single wallet address using RPC
 */
async function checkBNBBalance(address) {
  try {
    const rpcUrl = BSC_RPC_URLS[currentRpcIndex];
    
    const response = await axios.post(rpcUrl, {
      jsonrpc: '2.0',
      method: 'eth_getBalance',
      params: [address, 'latest'],
      id: 1
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.data.result) {
      // Convert hex balance to decimal
      const balance = parseInt(response.data.result, 16);
      // BNB has 18 decimals, so divide by 10^18 to get actual balance
      const actualBalance = balance / Math.pow(10, 18);
      
      // Debug logging
      console.log(`   Raw balance: ${response.data.result} (${balance}), Actual: ${actualBalance.toFixed(6)} BNB`);
      
      return {
        address,
        balance: actualBalance,
        hasBNB: actualBalance > 0
      };
    } else if (response.data.error) {
      console.error(`RPC Error for ${address}:`, response.data.error.message);
      
      // Try next RPC endpoint
      currentRpcIndex = (currentRpcIndex + 1) % BSC_RPC_URLS.length;
      
      return {
        address,
        balance: 0,
        hasBNB: false,
        error: response.data.error.message
      };
    } else {
      console.error(`Unexpected response for ${address}:`, JSON.stringify(response.data));
      return {
        address,
        balance: 0,
        hasBNB: false,
        error: 'Unexpected response format'
      };
    }
  } catch (error) {
    console.error(`Network error checking balance for ${address}:`, error.message);
    return {
      address,
      balance: 0,
      hasBNB: false,
      error: error.message
    };
  }
}

/**
 * Process wallet addresses and filter those with BNB
 */
async function filterWalletsWithBNB(wallets) {
  console.log(`🔍 Checking ${wallets.length} wallet addresses for BNB...`);

  const results = [];
  const addressesWithBNB = [];

  // Add delay between requests to avoid rate limiting
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  for (let i = 0; i < wallets.length; i++) {
    const address = wallets[i].trim();

    if (!address) {
      console.log(`⚠️ Skipping empty address at index ${i}`);
      continue;
    }

    // Basic address validation
    if (!address.startsWith('0x') || address.length !== 42) {
      console.log(`⚠️ Invalid address format: ${address}`);
      results.push({
        address,
        balance: 0,
        hasBNB: false,
        error: 'Invalid address format'
      });
      continue;
    }

    console.log(`📊 Checking ${i + 1}/${wallets.length}: ${address}`);

    const result = await checkBNBBalance(address);
    results.push(result);

    if (result.hasBNB) {
      addressesWithBNB.push(address);
      console.log(`✅ Found BNB: ${address} (${result.balance.toFixed(6)} BNB)`);
    }

    // Add delay to avoid rate limiting (BSCScan allows 5 calls/second)
    if (i < wallets.length - 1) {
      await delay(200);
    }
  }

  return {
    totalChecked: wallets.length,
    withBNB: addressesWithBNB.length,
    withoutBNB: wallets.length - addressesWithBNB.length,
    addressesWithBNB,
    detailedResults: results
  };
}

/**
 * Main function to process JSON input
 */
async function main() {
  try {
    console.log('🔗 Using BSC RPC endpoints (no API key required)');
    console.log(`📡 Available RPC endpoints: ${BSC_RPC_URLS.length}`);

    // Read input from command line argument or stdin
    let inputData;

    if (process.argv[2]) {
      // Read from file
      const filePath = process.argv[2];
      console.log(`📁 Reading addresses from file: ${filePath}`);
      inputData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } else {
      // Read from stdin
      console.log('📝 Enter JSON data (Ctrl+D to finish):');
      const stdinData = fs.readFileSync(0, 'utf8');
      inputData = JSON.parse(stdinData);
    }

    // Validate input format
    let addresses = [];

    if (Array.isArray(inputData)) {
      // Check if it's an array of objects with bsc_wallet_address
      if (inputData.length > 0 && inputData[0].bsc_wallet_address) {
        addresses = inputData.map(item => item.bsc_wallet_address);
        console.log(`📝 Detected object format with bsc_wallet_address field`);
      } else {
        // Simple array of addresses
        addresses = inputData;
        console.log(`📝 Detected simple array format`);
      }
    } else if (inputData.addresses && Array.isArray(inputData.addresses)) {
      addresses = inputData.addresses;
    } else if (inputData.wallets && Array.isArray(inputData.wallets)) {
      addresses = inputData.wallets;
    } else {
      console.error('❌ Invalid JSON format. Expected array of addresses or objects with "bsc_wallet_address"');
      process.exit(1);
    }

    console.log(`\n🚀 Starting BNB balance check for ${addresses.length} addresses...\n`);

    // Process the addresses
    const result = await filterWalletsWithBNB(addresses);

    // Output results
    console.log('\n📋 RESULTS SUMMARY:');
    console.log(`Total addresses checked: ${result.totalChecked}`);
    console.log(`Addresses with BNB: ${result.withBNB}`);
    console.log(`Addresses without BNB: ${result.withoutBNB}`);

    console.log('\n💰 ADDRESSES WITH BNB:');
    if (result.addressesWithBNB.length > 0) {
      result.addressesWithBNB.forEach((address, index) => {
        const details = result.detailedResults.find(r => r.address === address);
        console.log(`${index + 1}. ${address} - ${details.balance.toFixed(6)} BNB`);
      });
    } else {
      console.log('No addresses found with BNB balance');
    }

    // Calculate total BNB
    const totalBNB = result.detailedResults.reduce((sum, r) => sum + r.balance, 0);
    console.log(`\n💎 Total BNB across all wallets: ${totalBNB.toFixed(6)} BNB`);

    // Save detailed results to file
    const outputFileName = `bnb_check_result_${Date.now()}.json`;
    fs.writeFileSync(outputFileName, JSON.stringify(result, null, 2));
    console.log(`\n💾 Detailed results saved to: ${outputFileName}`);

    // Output JSON for programmatic use
    console.log('\n📄 JSON OUTPUT:');
    console.log(JSON.stringify({
      addressesWithBNB: result.addressesWithBNB,
      summary: {
        totalChecked: result.totalChecked,
        withBNB: result.withBNB,
        withoutBNB: result.withoutBNB,
        totalBNB: totalBNB
      }
    }, null, 2));

  } catch (error) {
    console.error('❌ Error processing request:', error.message);
    process.exit(1);
  }
}

// Handle command line arguments
if (require.main === module) {
  main();
}

module.exports = {
  checkBNBBalance,
  filterWalletsWithBNB
};
