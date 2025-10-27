# BNB Wallet Filter Script

A Node.js script that filters wallet addresses to find those containing BNB (Binance Coin) on the Binance Smart Chain (BSC).

## Features

- ✅ Check BNB balance for multiple wallet addresses
- ✅ Filter addresses with BNB balance > 0
- ✅ Rate limiting to avoid API restrictions
- ✅ Detailed logging and progress tracking
- ✅ JSON output for programmatic use
- ✅ Error handling for invalid addresses
- ✅ Save detailed results to file
- ✅ Calculate total BNB across all wallets

## Prerequisites

1. **Node.js**: Version 14 or higher
2. **npm**: For dependency management
3. **No API Key Required**: Uses public BSC RPC endpoints

## Installation

1. Install dependencies (if not already installed):
```bash
npm install
```

**Note:** This script uses direct BSC RPC endpoints (no API key required). It includes multiple RPC providers for automatic failover.

## Usage

### Method 1: Command Line with File

```bash
# Using the sample file (your format)
npm run filter:bnb

# Using your own file
node scripts/filter_bnb_wallets.js your_addresses.json
```

### Method 2: Command Line with JSON Array

```bash
node scripts/filter_bnb_wallets.js
# Then paste JSON and press Ctrl+D (Unix) or Ctrl+Z (Windows)
```

### Method 3: Programmatic Usage

```javascript
const { filterWalletsWithBNB } = require('./scripts/filter_bnb_wallets');

const addresses = [
  "0x742d35Cc6635C0532925a3b8D0007D9b0a4c5c8f0",
  "0x8ba1f109551bD432803012645Ac136c22C000000",
  // ... more addresses
];

filterWalletsWithBNB(addresses).then(result => {
  console.log('Addresses with BNB:', result.addressesWithBNB);
});
```

## Input Format

### JSON Array of Objects (Your Format)
```json
[
  {
    "bsc_wallet_address": "0x742d35Cc6635C0532925a3b8D0007D9b0a4c5c8f0"
  },
  {
    "bsc_wallet_address": "0x8ba1f109551bD432803012645Ac136c22C000000"
  }
]
```

### JSON Array (Simple)
```json
[
  "0x742d35Cc6635C0532925a3b8D0007D9b0a4c5c8f0",
  "0x8ba1f109551bD432803012645Ac136c22C000000",
  "0x55d398326f99059fF775485246999027B3197955"
]
```

## Output Format

The script outputs both console logs and JSON data:

### Console Output
```
🔍 Checking 3 wallet addresses for BNB...

📊 Checking 1/3: 0x742d35Cc6635C0532925a3b8D0007D9b0a4c5c8f0
✅ Found BNB: 0x742d35Cc6635C0532925a3b8D0007D9b0a4c5c8f0 (0.125000 BNB)

📊 Checking 2/3: 0x8ba1f109551bD432803012645Ac136c22C000000
❌ No BNB found: 0x8ba1f109551bD432803012645Ac136c22C000000 (0.000000 BNB)

📋 RESULTS SUMMARY:
Total addresses checked: 3
Addresses with BNB: 1
Addresses without BNB: 2

💰 ADDRESSES WITH BNB:
1. 0x742d35Cc6635C0532925a3b8D0007D9b0a4c5c8f0 - 0.125000 BNB

💎 Total BNB across all wallets: 0.125000 BNB
```

### JSON Output
```json
{
  "addressesWithBNB": [
    "0x742d35Cc6635C0532925a3b8D0007D9b0a4c5c8f0"
  ],
  "summary": {
    "totalChecked": 3,
    "withBNB": 1,
    "withoutBNB": 2,
    "totalBNB": 0.125
  }
}
```

### Detailed Results File
A detailed JSON file is also saved with complete balance information for each address.

## Configuration

### Environment Variables
- `BSCSCAN_API_KEY`: Your BSCScan API key (required)

### Rate Limiting
- The script includes a 200ms delay between requests to respect BSCScan's rate limits
- BSCScan allows 5 calls/second for free accounts

## Error Handling

The script handles various error scenarios:

- **Invalid addresses**: Skipped with warning
- **Network errors**: Logged with error details
- **API errors**: BSCScan error messages displayed
- **Rate limiting**: Automatic delays prevent hitting limits

## API Details

- **Asset**: Native BNB (Binance Coin)
- **Decimals**: 18 (BNB standard)
- **Network**: Binance Smart Chain (Chain ID: 56)
- **Method**: Direct RPC calls using `eth_getBalance`
- **RPC Endpoints**: 
  - bsc-dataseed1-4.binance.org (official Binance nodes)
  - rpc.ankr.com/bsc
  - bsc.publicnode.com
- **No API Key Required**: Uses public RPC endpoints

## Differences from USDT Script

- **Native Balance**: Checks native BNB balance (not a token contract)
- **API Action**: Uses `balance` action instead of `tokenbalance`
- **No Contract Address**: BNB is the native currency, not a BEP-20 token
- **Total Calculation**: Shows total BNB across all wallets

## Security Notes

- ✅ API key is not logged or exposed in output
- ✅ Wallet addresses are validated before API calls
- ✅ HTTPS used for all API communications
- ✅ No private keys or sensitive data required

## Troubleshooting

### Common Issues

1. **Network Errors**: Script automatically switches between RPC endpoints
2. **Rate Limited**: The script includes delays, but very large lists may need longer delays
3. **Invalid Address**: Ensure addresses are 42 characters and start with "0x"
4. **RPC Endpoint Down**: Script has 6 fallback RPC endpoints for reliability

### No API Key Required

This script uses direct BSC RPC endpoints which are free and public. No registration or API key is needed.

## Use Cases

- **Portfolio Management**: Check BNB balances across multiple wallets
- **Gas Fee Analysis**: Identify wallets that need BNB for transaction fees
- **Wallet Auditing**: Find wallets with remaining BNB balances
- **Migration Planning**: Identify wallets that need BNB consolidation

## License

MIT License - feel free to use and modify as needed.
