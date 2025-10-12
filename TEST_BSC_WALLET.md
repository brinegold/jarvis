# How to Test BSC Wallet Endpoint

## Step 1: Get Available User IDs

Visit this URL in your browser or API client:
```
GET http://localhost:3000/api/debug/profiles
```

This will show you the available user IDs in your database.

## Step 2: Test BSC Wallet Endpoint

Once you have a user ID from Step 1, use it in this URL:
```
GET http://localhost:3000/api/bsc/wallet?userId=YOUR_USER_ID_HERE
```

Replace `YOUR_USER_ID_HERE` with an actual user ID from your database.

## Example:

If the debug endpoint shows a user with ID `123e4567-e89b-12d3-a456-426614174000`, then test:
```
GET http://localhost:3000/api/bsc/wallet?userId=123e4567-e89b-12d3-a456-426614174000
```

## Alternative: Quick SQL Query

If you prefer to check directly in Supabase, run this SQL:
```sql
SELECT id, full_name, bsc_wallet_address 
FROM profiles 
ORDER BY created_at DESC 
LIMIT 5;
```

Copy one of the `id` values and use it in the BSC wallet endpoint.
