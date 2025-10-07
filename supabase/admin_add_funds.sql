-- Admin function to add funds to user wallet
-- This function allows admins to add funds to any user's main wallet

CREATE OR REPLACE FUNCTION admin_add_funds_to_user(
    p_user_id UUID,
    p_amount DECIMAL,
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    user_record RECORD;
    transaction_id UUID;
    result JSON;
BEGIN
    -- Check if current user is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND is_admin = TRUE
    ) THEN
        RAISE EXCEPTION 'Access denied. Admin privileges required.';
    END IF;
    
    -- Validate amount
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Amount must be greater than 0';
    END IF;
    
    -- Get user details
    SELECT * INTO user_record
    FROM public.profiles
    WHERE id = p_user_id;
    
    IF user_record IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;
    
    -- Add funds to user's main wallet
    UPDATE public.profiles
    SET main_wallet_balance = main_wallet_balance + p_amount
    WHERE id = p_user_id;
    
    -- Create transaction record
    INSERT INTO public.transactions (
        user_id,
        transaction_type,
        amount,
        net_amount,
        status,
        description,
        reference_id
    ) VALUES (
        p_user_id,
        'deposit',
        p_amount,
        p_amount,
        'completed',
        'Admin fund addition: ' || COALESCE(p_admin_notes, 'Manual fund addition by admin'),
        'ADMIN_ADD_' || extract(epoch from now())::text
    ) RETURNING id INTO transaction_id;
    
    -- Get updated user balance
    SELECT main_wallet_balance INTO user_record.main_wallet_balance
    FROM public.profiles
    WHERE id = p_user_id;
    
    -- Return result
    SELECT json_build_object(
        'success', true,
        'message', 'Funds added successfully',
        'user_id', p_user_id,
        'amount_added', p_amount,
        'new_balance', user_record.main_wallet_balance,
        'transaction_id', transaction_id,
        'admin_notes', p_admin_notes
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (admin check is done inside function)
GRANT EXECUTE ON FUNCTION admin_add_funds_to_user TO authenticated;

SELECT 'Admin add funds function created successfully!' as status;
