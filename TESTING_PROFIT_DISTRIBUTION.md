# Testing Automatic Profit Distribution

## Quick Start

### 1. Configure the Interval

Add this to your `.env.local` file:
```env
PROFIT_DISTRIBUTION_INTERVAL=1
```
This sets the distribution to run every 1 minute for testing.

### 2. Start the Development Server

```bash
npm run dev
```

### 3. What Happens Automatically

When you load any page of the app:
1. The `ServerInitializer` component calls `/api/init`
2. The init endpoint starts the automatic profit distribution
3. The system runs every 1 minute (based on your config)
4. Check your server console for logs

### 4. Expected Console Output

You should see logs like:
```
Initializing profit distribution with 1 minute interval...
Starting automated profit distribution system (every 1 minutes)...
Users will receive profits 24 hours after investing in a plan.
Profit distribution interval set to 1 minutes
Starting comprehensive profit distribution...
Starting regular investment profit distribution...
```

### 5. Testing the 24-Hour Rule

To test if profits are being distributed:

**Option A: Create a test investment**
1. Login to the app
2. Make an investment in any plan
3. Wait 24 hours (or modify the check temporarily)
4. After 24 hours, the next automatic run will distribute profits

**Option B: Manually trigger for testing**
```bash
curl -X POST http://localhost:3000/api/admin/distribute-profits \
  -H "Content-Type: application/json"
```

### 6. Check if Distribution is Running

Visit: `http://localhost:3000/api/init`

You should see:
```json
{
  "success": true,
  "message": "Server initialized. Profit distribution running every 1 minutes.",
  "intervalMinutes": 1,
  "timestamp": "2025-10-07T14:38:45.000Z"
}
```

### 7. Monitor Logs

Watch your terminal where `npm run dev` is running. Every minute you should see:
- "Starting comprehensive profit distribution..."
- "Starting regular investment profit distribution..."
- "No active investment plans found" (if no plans exist)
- OR profit distribution details if plans are eligible

## Troubleshooting

### Distribution Not Running?

1. **Check if the init endpoint was called**
   - Open browser console (F12)
   - Look for "Server initialization response" log

2. **Manually call the init endpoint**
   ```bash
   curl http://localhost:3000/api/init
   ```

3. **Check environment variable**
   - Make sure `PROFIT_DISTRIBUTION_INTERVAL=1` is in `.env.local`
   - Restart the dev server after adding it

### No Profits Being Distributed?

1. **Check if plans exist**
   - Query your database: `SELECT * FROM investment_plans WHERE is_active = true`

2. **Check 24-hour rule**
   - Plans must be at least 24 hours old
   - Check `created_at` timestamp of your investment plans

3. **Check for duplicate distributions**
   - System prevents distributing twice in the same day
   - Query: `SELECT * FROM profit_distributions WHERE distribution_date = CURRENT_DATE`

### Temporarily Disable 24-Hour Check (Testing Only)

Edit `lib/profit-distribution.ts` line 57:
```typescript
// Change from:
if (hoursSinceCreation < 24) {

// To (for testing):
if (hoursSinceCreation < 0.1) {  // 6 seconds for immediate testing
```

**Remember to change it back for production!**

## Production Configuration

For production, set a longer interval:

```env
# Run every hour
PROFIT_DISTRIBUTION_INTERVAL=60

# OR run once per day
PROFIT_DISTRIBUTION_INTERVAL=1440
```

## API Endpoints

- **Initialize/Start**: `GET /api/init`
- **Start with custom interval**: `POST /api/profit-distribution/start` with body `{"intervalMinutes": 60}`
- **Manual trigger**: `POST /api/admin/distribute-profits`

## Success Indicators

✅ Server logs show distribution running every minute
✅ No errors in console
✅ After 24 hours, user balances increase
✅ `profit_distributions` table gets new records
✅ `transactions` table shows profit transactions
