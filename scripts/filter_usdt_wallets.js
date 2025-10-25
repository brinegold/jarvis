const axios = require('axios');
const fs = require('fs');

// BSCScan API configuration
const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY || 'YOUR_BSCSCAN_API_KEY';
const BSCSCAN_BASE_URL = 'https://api.bscscan.com/api';

// USDT token contract address on BSC
const USDT_CONTRACT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';

/**
 * Check USDT balance for a single wallet address
 */
async function checkUSDTBalance(address) {
  try {
    const response = await axios.get(BSCSCAN_BASE_URL, {
      params: {
        module: 'account',
        action: 'tokenbalance',
        contractaddress: USDT_CONTRACT_ADDRESS,
        address: address,
        tag: 'latest',
        apikey: BSCSCAN_API_KEY
      }
    });

    if (response.data.status === '1') {
      const balance = parseInt(response.data.result);
      // USDT has 18 decimals, so divide by 10^18 to get actual balance
      const actualBalance = balance / Math.pow(10, 18);
      return {
        address,
        balance: actualBalance,
        hasUSDT: actualBalance > 0
      };
    } else {
      console.error(`Error checking balance for ${address}: ${response.data.message}`);
      return {
        address,
        balance: 0,
        hasUSDT: false,
        error: response.data.message
      };
    }
  } catch (error) {
    console.error(`Network error checking balance for ${address}:`, error.message);
    return {
      address,
      balance: 0,
      hasUSDT: false,
      error: error.message
    };
  }
}

/**
 * Process wallet addresses and filter those with USDT
 */
async function filterWalletsWithUSDT(wallets) {
  console.log(`🔍 Checking ${wallets.length} wallet addresses for USDT...`);

  const results = [];
  const addressesWithUSDT = [];

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
        hasUSDT: false,
        error: 'Invalid address format'
      });
      continue;
    }

    console.log(`📊 Checking ${i + 1}/${wallets.length}: ${address}`);

    const result = await checkUSDTBalance(address);
    results.push(result);

    if (result.hasUSDT) {
      addressesWithUSDT.push(address);
      console.log(`✅ Found USDT: ${address} (${result.balance} USDT)`);
    }

    // Add delay to avoid rate limiting (BSCScan allows 5 calls/second)
    if (i < wallets.length - 1) {
      await delay(200);
    }
  }

  return {
    totalChecked: wallets.length,
    withUSDT: addressesWithUSDT.length,
    withoutUSDT: wallets.length - addressesWithUSDT.length,
    addressesWithUSDT,
    detailedResults: results
  };
}

/**
 * Main function to process JSON input
 */
async function main() {
  try {
    // Check if API key is provided
    if (BSCSCAN_API_KEY === 'YOUR_BSCSCAN_API_KEY') {
      console.error('❌ Please set your BSCSCAN_API_KEY environment variable');
      console.log('💡 Get your free API key from: https://bscscan.com/apis');
      process.exit(1);
    }

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

    console.log(`\n🚀 Starting USDT balance check for ${addresses.length} addresses...\n`);

    // Process the addresses
    const result = await filterWalletsWithUSDT(addresses);

    // Output results
    console.log('\n📋 RESULTS SUMMARY:');
    console.log(`Total addresses checked: ${result.totalChecked}`);
    console.log(`Addresses with USDT: ${result.withUSDT}`);
    console.log(`Addresses without USDT: ${result.withoutUSDT}`);

    console.log('\n💰 ADDRESSES WITH USDT:');
    if (result.addressesWithUSDT.length > 0) {
      result.addressesWithUSDT.forEach((address, index) => {
        console.log(`${index + 1}. ${address}`);
      });
    } else {
      console.log('No addresses found with USDT balance');
    }

    // Save detailed results to file
    const outputFileName = `usdt_check_result_${Date.now()}.json`;
    fs.writeFileSync(outputFileName, JSON.stringify(result, null, 2));
    console.log(`\n💾 Detailed results saved to: ${outputFileName}`);

    // Output JSON for programmatic use
    console.log('\n📄 JSON OUTPUT:');
    console.log(JSON.stringify({
      addressesWithUSDT: result.addressesWithUSDT,
      summary: {
        totalChecked: result.totalChecked,
        withUSDT: result.withUSDT,
        withoutUSDT: result.withoutUSDT
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
  checkUSDTBalance,
  filterWalletsWithUSDT
};
