-- Fix: Remove referral commission processing from deposits
-- Commissions should only be processed when users activate staking, not on deposits

-- Updated function to process BSC deposit WITHOUT referral commissions
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

    -- Add to user's fund wallet (NO REFERRAL COMMISSIONS ON DEPOSIT)
    PERFORM add_to_fund_wallet(p_user_id, p_net_amount);

    -- NOTE: Referral commissions are now only processed when user activates staking
    -- This is handled by the dualReferralService in the staking/investment pages

    RETURN transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION process_bsc_deposit TO authenticated;

SELECT 'Deposit referral commission fix applied successfully!' as status;
