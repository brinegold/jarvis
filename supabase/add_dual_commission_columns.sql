-- Migration: Add dual commission columns to referral_commissions table
-- This adds support for separate USDT and JRC commission tracking

-- Add new columns for dual commission system
ALTER TABLE public.referral_commissions 
ADD COLUMN IF NOT EXISTS usdt_commission DECIMAL(20,8) DEFAULT 0,
ADD COLUMN IF NOT EXISTS jrc_commission DECIMAL(20,8) DEFAULT 0,
ADD COLUMN IF NOT EXISTS jrc_percentage DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS transaction_type TEXT DEFAULT 'investment',
ADD COLUMN IF NOT EXISTS plan_type TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing records to have usdt_commission = commission_amount for backward compatibility
UPDATE public.referral_commissions 
SET usdt_commission = commission_amount 
WHERE usdt_commission = 0 OR usdt_commission IS NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_referral_commissions_transaction_type 
ON public.referral_commissions(transaction_type);

CREATE INDEX IF NOT EXISTS idx_referral_commissions_level 
ON public.referral_commissions(level);

-- Add trigger to update updated_at column
CREATE OR REPLACE FUNCTION update_referral_commission_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_referral_commissions_updated_at ON public.referral_commissions;
CREATE TRIGGER update_referral_commissions_updated_at
    BEFORE UPDATE ON public.referral_commissions
    FOR EACH ROW EXECUTE FUNCTION update_referral_commission_updated_at();

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.referral_commissions TO authenticated;

SELECT 'Dual commission columns added successfully!' as status;
