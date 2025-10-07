-- Test referral system functionality
-- Run this to verify referral commissions are working

-- 1. Check referral relationships
CREATE OR REPLACE FUNCTION check_referral_chain(p_user_id UUID)
RETURNS TABLE(
    level INTEGER,
    referrer_id UUID,
    referrer_username TEXT,
    referrer_code TEXT,
    commission_rate DECIMAL
) AS $$
DECLARE
    commission_rates DECIMAL[] := ARRAY[15.0, 10.0, 5.0, 3.0, 2.0, 1.0, 0.5, 0.2, 0.1, 0.05];
    current_referrer_code TEXT;
    current_referrer_id UUID;
    current_username TEXT;
    level_counter INTEGER := 1;
BEGIN
    -- Get user's sponsor_id
    SELECT sponsor_id INTO current_referrer_code
    FROM public.profiles
    WHERE id = p_user_id;
    
    -- Loop through referral chain
    WHILE current_referrer_code IS NOT NULL AND level_counter <= 10 LOOP
        -- Find referrer
        SELECT id, username INTO current_referrer_id, current_username
        FROM public.profiles
        WHERE referral_code = current_referrer_code;
        
        IF current_referrer_id IS NOT NULL THEN
            -- Return this level
            level := level_counter;
            referrer_id := current_referrer_id;
            referrer_username := current_username;
            referrer_code := current_referrer_code;
            commission_rate := commission_rates[level_counter];
            RETURN NEXT;
            
            -- Get next level
            SELECT sponsor_id INTO current_referrer_code
            FROM public.profiles
            WHERE id = current_referrer_id;
            
            level_counter := level_counter + 1;
        ELSE
            EXIT;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. View all referral commissions for a user
CREATE OR REPLACE VIEW user_referral_earnings AS
SELECT 
    p.id as user_id,
    p.username,
    p.referral_code,
    COUNT(rc.id) as total_commissions,
    SUM(rc.commission_amount) as total_earned,
    SUM(CASE WHEN rc.level = 1 THEN rc.commission_amount ELSE 0 END) as level_1_earnings,
    SUM(CASE WHEN rc.level = 2 THEN rc.commission_amount ELSE 0 END) as level_2_earnings,
    SUM(CASE WHEN rc.level = 3 THEN rc.commission_amount ELSE 0 END) as level_3_earnings
FROM public.profiles p
LEFT JOIN public.referral_commissions rc ON p.id = rc.referrer_id
GROUP BY p.id, p.username, p.referral_code
ORDER BY total_earned DESC NULLS LAST;

-- 3. Test deposit with referral commissions
CREATE OR REPLACE FUNCTION test_deposit_with_referrals(
    p_user_id UUID,
    p_amount DECIMAL DEFAULT 100.00
)
RETURNS TABLE(
    transaction_id UUID,
    referral_level INTEGER,
    referrer_id UUID,
    referrer_username TEXT,
    commission_amount DECIMAL,
    referrer_balance_before DECIMAL,
    referrer_balance_after DECIMAL
) AS $$
DECLARE
    test_tx_id UUID;
    referrer_record RECORD;
    balance_before DECIMAL;
    balance_after DECIMAL;
BEGIN
    -- Process test deposit
    SELECT process_bsc_deposit(
        p_user_id,
        p_amount,
        p_amount * 0.01, -- 1% fee
        p_amount * 0.99, -- 99% net
        'test-tx-' || EXTRACT(EPOCH FROM NOW()),
        '0xTestFromAddress',
        '0xTestToAddress'
    ) INTO test_tx_id;
    
    -- Return commission details
    FOR referrer_record IN
        SELECT 
            rc.transaction_id,
            rc.level,
            rc.referrer_id,
            p.username,
            rc.commission_amount
        FROM public.referral_commissions rc
        JOIN public.profiles p ON rc.referrer_id = p.id
        WHERE rc.transaction_id = test_tx_id
        ORDER BY rc.level
    LOOP
        transaction_id := referrer_record.transaction_id;
        referral_level := referrer_record.level;
        referrer_id := referrer_record.referrer_id;
        referrer_username := referrer_record.username;
        commission_amount := referrer_record.commission_amount;
        
        -- Get current balance (this would be after commission)
        SELECT main_wallet_balance INTO referrer_balance_after
        FROM public.profiles
        WHERE id = referrer_record.referrer_id;
        
        referrer_balance_before := referrer_balance_after - referrer_record.commission_amount;
        
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_referral_chain TO authenticated;
GRANT EXECUTE ON FUNCTION test_deposit_with_referrals TO authenticated;
GRANT SELECT ON user_referral_earnings TO authenticated;

SELECT 'Referral testing functions created!' as status;
