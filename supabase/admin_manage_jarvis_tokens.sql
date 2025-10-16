-- Admin functions to manage jarvis tokens for users
-- These functions allow admins to add or deduct jarvis tokens from any user

-- Function to add jarvis tokens to user
CREATE OR REPLACE FUNCTION admin_add_jarvis_tokens(
    p_user_id UUID,
    p_amount INTEGER,
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
    
    -- Add jarvis tokens to user
    UPDATE public.profiles
    SET total_jarvis_tokens = COALESCE(total_jarvis_tokens, 0) + p_amount
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
        'jarvis_token_add',
        p_amount,
        p_amount,
        'completed',
        'Admin jarvis token addition: ' || COALESCE(p_admin_notes, 'Manual jarvis token addition by admin'),
        'ADMIN_JRV_ADD_' || extract(epoch from now())::text
    ) RETURNING id INTO transaction_id;
    
    -- Get updated user token balance
    SELECT total_jarvis_tokens INTO user_record.total_jarvis_tokens
    FROM public.profiles
    WHERE id = p_user_id;
    
    -- Return result
    SELECT json_build_object(
        'success', true,
        'message', 'Jarvis tokens added successfully',
        'user_id', p_user_id,
        'tokens_added', p_amount,
        'new_token_balance', user_record.total_jarvis_tokens,
        'transaction_id', transaction_id,
        'admin_notes', p_admin_notes
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to deduct jarvis tokens from user
CREATE OR REPLACE FUNCTION admin_deduct_jarvis_tokens(
    p_user_id UUID,
    p_amount INTEGER,
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
    
    -- Check if user has sufficient tokens
    IF COALESCE(user_record.total_jarvis_tokens, 0) < p_amount THEN
        RAISE EXCEPTION 'Insufficient tokens. User has % but trying to deduct %', COALESCE(user_record.total_jarvis_tokens, 0), p_amount;
    END IF;
    
    -- Deduct jarvis tokens from user
    UPDATE public.profiles
    SET total_jarvis_tokens = COALESCE(total_jarvis_tokens, 0) - p_amount
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
        'jarvis_token_deduct',
        p_amount,
        p_amount,
        'completed',
        'Admin jarvis token deduction: ' || COALESCE(p_admin_notes, 'Manual jarvis token deduction by admin'),
        'ADMIN_JRV_DEDUCT_' || extract(epoch from now())::text
    ) RETURNING id INTO transaction_id;
    
    -- Get updated user token balance
    SELECT total_jarvis_tokens INTO user_record.total_jarvis_tokens
    FROM public.profiles
    WHERE id = p_user_id;
    
    -- Return result
    SELECT json_build_object(
        'success', true,
        'message', 'Jarvis tokens deducted successfully',
        'user_id', p_user_id,
        'tokens_deducted', p_amount,
        'new_token_balance', user_record.total_jarvis_tokens,
        'transaction_id', transaction_id,
        'admin_notes', p_admin_notes
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users (admin check is done inside functions)
GRANT EXECUTE ON FUNCTION admin_add_jarvis_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION admin_deduct_jarvis_tokens TO authenticated;

SELECT 'Admin jarvis token management functions created successfully!' as status;
