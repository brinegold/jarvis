-- Add missing transaction types for transfers
-- This migration adds the missing transaction types that are being used in the transfer functionality

-- Add transfer-related transaction types to the enum
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'transfer_sent';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'transfer_received';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'wallet_transfer';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'signup_bonus';

-- Note: These transaction types are used in:
-- - transfer_sent: When a user sends money to another user
-- - transfer_received: When a user receives money from another user  
-- - wallet_transfer: When transferring between main and fund wallets
-- - signup_bonus: For signup bonus tokens (used in dashboard)
