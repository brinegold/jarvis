# Fix Referral Commission "NOT NULL constraint" Error

## The Problem
The `referral_commissions` table has NOT NULL constraints on `commission_amount` and `transaction_id`, but the new dual commission system doesn't always provide these values.

## Solution Steps

### Step 1: Fix Database Constraints
Run this SQL in your Supabase SQL editor:

```sql
-- Fix referral_commissions table constraints
ALTER TABLE public.referral_commissions 
ADD COLUMN IF NOT EXISTS usdt_commission DECIMAL(20,8) DEFAULT 0,
ADD COLUMN IF NOT EXISTS jrc_commission DECIMAL(20,8) DEFAULT 0,
ADD COLUMN IF NOT EXISTS jrc_percentage DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS transaction_type TEXT DEFAULT 'investment',
ADD COLUMN IF NOT EXISTS plan_type TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Make problematic columns nullable
ALTER TABLE public.referral_commissions 
ALTER COLUMN commission_amount DROP NOT NULL;

ALTER TABLE public.referral_commissions 
ALTER COLUMN transaction_id DROP NOT NULL;

-- Create trigger to sync commission_amount with usdt_commission
CREATE OR REPLACE FUNCTION sync_commission_amount()
RETURNS TRIGGER AS $$
BEGIN
    NEW.commission_amount = COALESCE(NEW.usdt_commission, NEW.commission_amount, 0);
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_commission_amount_trigger ON public.referral_commissions;
CREATE TRIGGER sync_commission_amount_trigger
    BEFORE INSERT OR UPDATE ON public.referral_commissions
    FOR EACH ROW EXECUTE FUNCTION sync_commission_amount();
```

### Step 2: Test the Fix
1. Go to your app and make a test investment with a referral link
2. Check the referral page - it should now show real commission data
3. Check the `referral_commissions` table in Supabase to verify data is being saved

### Step 3: Verify Data Structure
Run this query to check the table structure:

```sql
SELECT column_name, is_nullable, column_default, data_type
FROM information_schema.columns 
WHERE table_name = 'referral_commissions' 
AND table_schema = 'public'
ORDER BY ordinal_position;
```

## Expected Result
- ✅ No more "NOT NULL constraint" errors
- ✅ Referral commissions saved to `referral_commissions` table
- ✅ Referral page shows real commission data
- ✅ Both USDT and JRC commissions tracked properly

## If Still Having Issues
Run the debug script in browser console on the referral page to see detailed information about what's happening.
