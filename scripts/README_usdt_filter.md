# USDT Wallet Filter Script

A Node.js script that filters wallet addresses to find those containing USDT tokens on the Binance Smart Chain (BSC).

## Features

- ✅ Check USDT balance for multiple wallet addresses
- ✅ Filter addresses with USDT balance > 0
- ✅ Rate limiting to avoid API restrictions
- ✅ Detailed logging and progress tracking
- ✅ JSON output for programmatic use
- ✅ Error handling for invalid addresses
- ✅ Save detailed results to file

## Prerequisites

1. **BSCScan API Key**: Get your free API key from [BSCScan](https://bscscan.com/apis)
2. **Node.js**: Version 14 or higher
3. **npm**: For dependency management

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set your BSCScan API key:
```bash
export BSCSCAN_API_KEY=your_api_key_here
# OR create a .env file with:
# BSCSCAN_API_KEY=your_api_key_here
```

## Usage

### Method 1: Command Line with File

```bash
# Using the sample file (your format)
npm run filter:usdt

# Using your own file
node scripts/filter_usdt_wallets.js your_addresses.json
```

### Method 2: Command Line with JSON Array

```bash
node scripts/filter_usdt_wallets.js
# Then paste JSON and press Ctrl+D (Unix) or Ctrl+Z (Windows)
```

### Method 3: Programmatic Usage

```javascript
const { filterWalletsWithUSDT } = require('./scripts/filter_usdt_wallets');

const addresses = [
  "0x742d35Cc6635C0532925a3b8D0007D9b0a4c5c8f0",
  "0x8ba1f109551bD432803012645Ac136c22C000000",
  // ... more addresses
];

filterWalletsWithUSDT(addresses).then(result => {
  console.log('Addresses with USDT:', result.addressesWithUSDT);
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
🔍 Checking 3 wallet addresses for USDT...

📊 Checking 1/3: 0x742d35Cc6635C0532925a3b8D0007D9b0a4c5c8f0
✅ Found USDT: 0x742d35Cc6635C0532925a3b8D0007D9b0a4c5c8f0 (150.5 USDT)

📊 Checking 2/3: 0x8ba1f109551bD432803012645Ac136c22C000000
❌ No USDT found: 0x8ba1f109551bD432803012645Ac136c22C000000 (0 USDT)

📋 RESULTS SUMMARY:
Total addresses checked: 3
Addresses with USDT: 1
Addresses without USDT: 2

💰 ADDRESSES WITH USDT:
1. 0x742d35Cc6635C0532925a3b8D0007D9b0a4c5c8f0
```

### JSON Output
```json
{
  "addressesWithUSDT": [
    "0x742d35Cc6635C0532925a3b8D0007D9b0a4c5c8f0"
  ],
  "summary": {
    "totalChecked": 3,
    "withUSDT": 1,
    "withoutUSDT": 2
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

- **Token Contract**: USDT on BSC (`0x55d398326f99059fF775485246999027B3197955`)
- **Decimals**: 18 (USDT standard)
- **Network**: Binance Smart Chain
- **Endpoint**: BSCScan Token Balance API

## Security Notes

- ✅ API key is not logged or exposed in output
- ✅ Wallet addresses are validated before API calls
- ✅ HTTPS used for all API communications
- ✅ No private keys or sensitive data required

## Troubleshooting

### Common Issues

1. **"Invalid API Key"**: Check your BSCScan API key
2. **Rate Limited**: The script includes delays, but very large lists may need longer delays
3. **Invalid Address**: Ensure addresses are 42 characters and start with "0x"

### Getting BSCScan API Key

1. Visit [BSCScan API Registration](https://bscscan.com/apis)
2. Create a free account
3. Generate an API key
4. Set the environment variable: `export BSCSCAN_API_KEY=your_key`

## License

MIT License - feel free to use and modify as needed.
