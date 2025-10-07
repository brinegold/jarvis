-- BSC Integration Migration SQL - PART 1
-- Run this FIRST in your Supabase SQL editor

-- 1. Add BSC wallet address field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS bsc_wallet_address TEXT;

-- 2. Create index for BSC wallet addresses for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_bsc_wallet 
ON public.profiles(bsc_wallet_address);

-- 3. Add BSC-related transaction types to the enum
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'bsc_deposit';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'bsc_withdrawal';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'referral_bonus';

-- 4. Add BSC transaction fields to transactions table
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS blockchain_tx_hash TEXT,
ADD COLUMN IF NOT EXISTS blockchain_network TEXT DEFAULT 'BSC',
ADD COLUMN IF NOT EXISTS token_contract_address TEXT,
ADD COLUMN IF NOT EXISTS from_address TEXT,
ADD COLUMN IF NOT EXISTS to_address TEXT;

-- 5. Create index for blockchain transaction hash lookups
CREATE INDEX IF NOT EXISTS idx_transactions_blockchain_tx_hash 
ON public.transactions(blockchain_tx_hash);

-- 6. Create index for reference_id to prevent duplicate processing
CREATE INDEX IF NOT EXISTS idx_transactions_reference_id 
ON public.transactions(reference_id);

SELECT 'Part 1 completed - Enum values and schema updates added!' as status;
