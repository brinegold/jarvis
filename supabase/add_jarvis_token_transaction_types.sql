-- Add jarvis token transaction types to the transaction_type enum
-- This allows tracking of jarvis token additions and deductions

-- Add new transaction types to the enum
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'jarvis_token_add';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'jarvis_token_deduct';

SELECT 'Jarvis token transaction types added successfully!' as status;
