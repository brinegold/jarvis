-- Fix referral commission processing for BSC deposits
-- This updates the process_bsc_deposit function to work with the existing schema

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
    commission_rates DECIMAL[] := ARRAY[15.0, 10.0, 5.0, 3.0, 2.0, 1.0, 0.5, 0.2, 0.1, 0.05];
    commission_amount DECIMAL(20,8);
    current_referrer_code TEXT;
    current_referrer_id UUID;
    level_counter INTEGER := 1;
    depositor_profile RECORD;
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

    -- Get depositor's sponsor_id to start referral chain
    SELECT sponsor_id INTO current_referrer_code
    FROM public.profiles
    WHERE id = p_user_id;

    -- Process referral commissions if user has a sponsor
    IF current_referrer_code IS NOT NULL THEN
        -- Loop through referral levels
        WHILE current_referrer_code IS NOT NULL AND level_counter <= 10 LOOP
            -- Find the referrer by referral_code
            SELECT id INTO current_referrer_id
            FROM public.profiles
            WHERE referral_code = current_referrer_code;
            
            IF current_referrer_id IS NOT NULL THEN
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
                    
                    -- Also create referral commission record for tracking
                    INSERT INTO public.referral_commissions (
                        referrer_id,
                        referred_id,
                        transaction_id,
                        level,
                        commission_percentage,
                        commission_amount
                    ) VALUES (
                        current_referrer_id,
                        p_user_id,
                        transaction_id,
                        level_counter,
                        commission_rates[level_counter],
                        commission_amount
                    );
                    
                    RAISE NOTICE 'Level % commission: % USDT paid to referrer %', level_counter, commission_amount, current_referrer_id;
                END IF;
                
                -- Get the next referrer's sponsor_id for the chain
                SELECT sponsor_id INTO current_referrer_code
                FROM public.profiles
                WHERE id = current_referrer_id;
                
                level_counter := level_counter + 1;
            ELSE
                -- Referrer not found, break the chain
                EXIT;
            END IF;
        END LOOP;
    END IF;

    RETURN transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to build referral relationships (run this once to populate referrals table)
CREATE OR REPLACE FUNCTION build_referral_relationships()
RETURNS INTEGER AS $$
DECLARE
    user_record RECORD;
    referrer_record RECORD;
    current_referrer_code TEXT;
    current_referrer_id UUID;
    level_counter INTEGER;
    relationships_created INTEGER := 0;
BEGIN
    -- Clear existing referral relationships
    DELETE FROM public.referrals;
    
    -- Loop through all users who have a sponsor
    FOR user_record IN 
        SELECT id, sponsor_id, username 
        FROM public.profiles 
        WHERE sponsor_id IS NOT NULL
    LOOP
        current_referrer_code := user_record.sponsor_id;
        level_counter := 1;
        
        -- Build referral chain up to 10 levels
        WHILE current_referrer_code IS NOT NULL AND level_counter <= 10 LOOP
            -- Find referrer by referral_code
            SELECT id INTO current_referrer_id
            FROM public.profiles
            WHERE referral_code = current_referrer_code;
            
            IF current_referrer_id IS NOT NULL THEN
                -- Insert referral relationship
                INSERT INTO public.referrals (referrer_id, referred_id, level)
                VALUES (current_referrer_id, user_record.id, level_counter)
                ON CONFLICT (referrer_id, referred_id) DO NOTHING;
                
                relationships_created := relationships_created + 1;
                
                -- Get next level referrer
                SELECT sponsor_id INTO current_referrer_code
                FROM public.profiles
                WHERE id = current_referrer_id;
                
                level_counter := level_counter + 1;
            ELSE
                EXIT;
            END IF;
        END LOOP;
    END LOOP;
    
    RETURN relationships_created;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION build_referral_relationships TO authenticated;

-- Run this to build all referral relationships
SELECT build_referral_relationships() as relationships_created;

SELECT 'Referral commission system fixed!' as status;
