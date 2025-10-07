-- BSC Integration Migration SQL
-- Run this in your Supabase SQL editor to add BSC functionality

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

-- 7. Function to add amount to main wallet
CREATE OR REPLACE FUNCTION add_to_main_wallet(user_id UUID, amount DECIMAL)
RETURNS VOID AS $$
BEGIN
    UPDATE public.profiles
    SET main_wallet_balance = main_wallet_balance + amount,
        updated_at = NOW()
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Function to add amount to fund wallet
CREATE OR REPLACE FUNCTION add_to_fund_wallet(user_id UUID, amount DECIMAL)
RETURNS VOID AS $$
BEGIN
    UPDATE public.profiles
    SET fund_wallet_balance = fund_wallet_balance + amount,
        updated_at = NOW()
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Function to process BSC deposit with referral commissions
CREATE OR REPLACE FUNCTION process_bsc_deposit(
    p_user_id UUID,
    p_deposit_amount DECIMAL,
    p_fee_amount DECIMAL,
    p_net_amount DECIMAL,
    p_tx_hash TEXT,
    p_from_address TEXT,
    p_to_address TEXT
)
RETURNS UUID AS $$
DECLARE
    transaction_id UUID;
    referral_record RECORD;
    commission_rates DECIMAL[] := ARRAY[15.0, 10.0, 5.0, 3.0, 2.0, 1.0, 0.5, 0.2, 0.1, 0.05];
    commission_amount DECIMAL(20,8);
    current_referrer_id UUID;
    level_counter INTEGER := 1;
BEGIN
    -- Create deposit transaction
    INSERT INTO public.transactions (
        user_id,
        transaction_type,
        amount,
        fee,
        net_amount,
        status,
        description,
        reference_id,
        blockchain_tx_hash,
        blockchain_network,
        token_contract_address,
        from_address,
        to_address
    ) VALUES (
        p_user_id,
        'bsc_deposit',
        p_deposit_amount,
        p_fee_amount,
        p_net_amount,
        'completed',
        'BSC USDT deposit - TX: ' || p_tx_hash,
        p_tx_hash,
        p_tx_hash,
        'BSC',
        '0x7C5FCE4f6aF59eCd7a557Fa9a7812Eaf0A4E42cb', -- Testnet USDT
        p_from_address,
        p_to_address
    ) RETURNING id INTO transaction_id;

    -- Add to user's fund wallet
    PERFORM add_to_fund_wallet(p_user_id, p_net_amount);

    -- Process referral commissions
    SELECT p.id INTO current_referrer_id
    FROM public.profiles p
    JOIN public.profiles user_p ON user_p.sponsor_id = p.referral_code
    WHERE user_p.id = p_user_id;

    -- Loop through referral levels
    WHILE current_referrer_id IS NOT NULL AND level_counter <= 10 LOOP
        -- Calculate commission for this level
        commission_amount := p_net_amount * (commission_rates[level_counter] / 100.0);
        
        IF commission_amount > 0 THEN
            -- Add commission to referrer's main wallet
            PERFORM add_to_main_wallet(current_referrer_id, commission_amount);
            
            -- Create commission transaction record
            INSERT INTO public.transactions (
                user_id,
                transaction_type,
                amount,
                net_amount,
                status,
                description,
                reference_id
            ) VALUES (
                current_referrer_id,
                'referral_bonus',
                commission_amount,
                commission_amount,
                'completed',
                'Level ' || level_counter || ' referral commission from BSC deposit',
                p_tx_hash || '-ref-' || level_counter
            );
        END IF;
        
        level_counter := level_counter + 1;
        
        -- Get the next referrer in the chain
        SELECT p.id INTO current_referrer_id
        FROM public.profiles p
        JOIN public.profiles current_p ON current_p.sponsor_id = p.referral_code
        WHERE current_p.id = current_referrer_id;
    END LOOP;

    RETURN transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Function to check if transaction hash already processed
CREATE OR REPLACE FUNCTION is_transaction_processed(tx_hash TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    tx_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO tx_count
    FROM public.transactions
    WHERE reference_id = tx_hash;
    
    RETURN tx_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Function to get user's BSC wallet info
CREATE OR REPLACE FUNCTION get_user_bsc_wallet(p_user_id UUID)
RETURNS TABLE(
    user_id UUID,
    bsc_wallet_address TEXT,
    main_balance DECIMAL,
    fund_balance DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.bsc_wallet_address,
        p.main_wallet_balance,
        p.fund_wallet_balance
    FROM public.profiles p
    WHERE p.id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Function to create withdrawal request
CREATE OR REPLACE FUNCTION create_withdrawal_request(
    p_user_id UUID,
    p_amount DECIMAL,
    p_fee DECIMAL,
    p_net_amount DECIMAL,
    p_bsc_address TEXT
)
RETURNS UUID AS $$
DECLARE
    transaction_id UUID;
    user_balance DECIMAL;
BEGIN
    -- Check user balance
    SELECT main_wallet_balance INTO user_balance
    FROM public.profiles
    WHERE id = p_user_id;
    
    IF user_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient balance. Required: %, Available: %', p_amount, user_balance;
    END IF;
    
    -- Create withdrawal transaction
    INSERT INTO public.transactions (
        user_id,
        transaction_type,
        amount,
        fee,
        net_amount,
        status,
        description,
        reference_id,
        to_address
    ) VALUES (
        p_user_id,
        'bsc_withdrawal',
        p_amount,
        p_fee,
        p_net_amount,
        'pending',
        'BSC withdrawal request to ' || p_bsc_address,
        'withdrawal-' || EXTRACT(EPOCH FROM NOW()) || '-' || p_user_id,
        p_bsc_address
    ) RETURNING id INTO transaction_id;
    
    -- Deduct from user's main wallet
    UPDATE public.profiles
    SET main_wallet_balance = main_wallet_balance - p_amount,
        updated_at = NOW()
    WHERE id = p_user_id;
    
    RETURN transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Function to approve/reject withdrawal
CREATE OR REPLACE FUNCTION process_withdrawal_approval(
    p_transaction_id UUID,
    p_approve BOOLEAN,
    p_blockchain_tx_hash TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    tx_record RECORD;
BEGIN
    -- Get transaction details
    SELECT * INTO tx_record
    FROM public.transactions
    WHERE id = p_transaction_id
    AND transaction_type = 'bsc_withdrawal'
    AND status = 'pending';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Withdrawal transaction not found or already processed';
    END IF;
    
    IF p_approve THEN
        -- Approve withdrawal
        UPDATE public.transactions
        SET status = 'completed',
            blockchain_tx_hash = p_blockchain_tx_hash,
            description = description || ' - Completed: ' || COALESCE(p_blockchain_tx_hash, 'Manual approval'),
            updated_at = NOW()
        WHERE id = p_transaction_id;
    ELSE
        -- Reject withdrawal - refund user
        UPDATE public.transactions
        SET status = 'cancelled',
            description = description || ' - Rejected by admin',
            updated_at = NOW()
        WHERE id = p_transaction_id;
        
        -- Refund user's balance
        UPDATE public.profiles
        SET main_wallet_balance = main_wallet_balance + tx_record.amount,
            updated_at = NOW()
        WHERE id = tx_record.user_id;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. Create view for BSC transaction history
CREATE OR REPLACE VIEW bsc_transaction_history AS
SELECT 
    t.id,
    t.user_id,
    p.username,
    p.full_name,
    t.transaction_type,
    t.amount,
    t.fee,
    t.net_amount,
    t.status,
    t.blockchain_tx_hash,
    t.from_address,
    t.to_address,
    t.description,
    t.created_at,
    t.updated_at
FROM public.transactions t
JOIN public.profiles p ON t.user_id = p.id
WHERE t.transaction_type IN ('bsc_deposit', 'bsc_withdrawal')
ORDER BY t.created_at DESC;

-- 15. Grant necessary permissions
GRANT EXECUTE ON FUNCTION add_to_main_wallet TO authenticated;
GRANT EXECUTE ON FUNCTION add_to_fund_wallet TO authenticated;
GRANT EXECUTE ON FUNCTION process_bsc_deposit TO authenticated;
GRANT EXECUTE ON FUNCTION is_transaction_processed TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_bsc_wallet TO authenticated;
GRANT EXECUTE ON FUNCTION create_withdrawal_request TO authenticated;
GRANT EXECUTE ON FUNCTION process_withdrawal_approval TO authenticated;

-- 16. Enable RLS on new view (if needed)
-- ALTER VIEW bsc_transaction_history ENABLE ROW LEVEL SECURITY;

-- Migration completed successfully
SELECT 'BSC Integration migration completed successfully!' as status;
