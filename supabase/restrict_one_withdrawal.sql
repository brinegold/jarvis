-- Migration to restrict users to only 1 pending withdrawal request at a time
-- Run this in Supabase SQL Editor

-- Update the create_withdrawal_request function to check for existing pending withdrawals
CREATE OR REPLACE FUNCTION create_withdrawal_request(
    p_user_id UUID,
    p_amount DECIMAL,
    p_fee DECIMAL,
    p_net_amount DECIMAL,
    p_bsc_address TEXT
)
RETURNS UUID AS $$
DECLARE
    request_id UUID;
    user_balance DECIMAL;
    pending_count INTEGER;
BEGIN
    -- Check for existing pending withdrawal requests
    SELECT COUNT(*) INTO pending_count
    FROM public.transactions
    WHERE user_id = p_user_id
    AND transaction_type = 'withdrawal'
    AND status = 'pending';
    
    IF pending_count > 0 THEN
        RAISE EXCEPTION 'You already have a pending withdrawal request. Please wait for it to be processed before submitting a new one.';
    END IF;
    
    -- Check if user has sufficient balance
    SELECT main_wallet_balance INTO user_balance
    FROM public.profiles
    WHERE id = p_user_id;
    
    IF user_balance IS NULL THEN
        RAISE EXCEPTION 'User profile not found';
    END IF;
    
    IF user_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient balance. Available: %, Requested: %', user_balance, p_amount;
    END IF;
    
    -- Create withdrawal request
    INSERT INTO public.withdrawal_requests (user_id, amount, wallet_address)
    VALUES (p_user_id, p_amount, p_bsc_address)
    RETURNING id INTO request_id;
    
    -- Create transaction record
    INSERT INTO public.transactions (
        user_id,
        transaction_type,
        amount,
        fee,
        net_amount,
        status,
        description,
        reference_id
    ) VALUES (
        p_user_id,
        'withdrawal',
        p_amount,
        p_fee,
        p_net_amount,
        'pending',
        'Withdrawal request to ' || p_bsc_address,
        request_id::TEXT
    );
    
    -- Deduct amount from user's main wallet
    UPDATE public.profiles
    SET main_wallet_balance = main_wallet_balance - p_amount
    WHERE id = p_user_id;
    
    RETURN request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_withdrawal_request TO authenticated;

-- Verification query to check for users with multiple pending withdrawals
SELECT 
    user_id,
    COUNT(*) as pending_count,
    SUM(amount) as total_pending_amount
FROM transactions
WHERE transaction_type = 'withdrawal'
AND status = 'pending'
GROUP BY user_id
HAVING COUNT(*) > 1
ORDER BY pending_count DESC;

SELECT 'Migration completed - Users can now only have 1 pending withdrawal at a time' as status;
