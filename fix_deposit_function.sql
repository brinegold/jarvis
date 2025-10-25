-- Fix the column name issues in database functions
-- Run this in Supabase SQL Editor

-- Drop existing functions first
DROP FUNCTION IF EXISTS process_manual_deposit_approval(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS reject_manual_deposit(UUID, UUID, TEXT);

-- Recreate with correct column names
CREATE OR REPLACE FUNCTION process_manual_deposit_approval(
  p_request_id UUID,
  p_admin_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request deposit_requests%ROWTYPE;
  v_fee_amount DECIMAL(15,2);
  v_net_amount DECIMAL(15,2);
  v_transaction_id UUID;
  v_result JSON;
BEGIN
  SELECT * INTO v_request
  FROM deposit_requests
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Deposit request not found or already processed');
  END IF;

  v_fee_amount := v_request.amount * 0.01;
  v_net_amount := v_request.amount - v_fee_amount;

  INSERT INTO transactions (
    user_id,
    transaction_type,
    amount,
    fee,
    net_amount,
    status,
    description,
    reference_id,
    created_at
  ) VALUES (
    v_request.user_id,
    'deposit'::transaction_type,
    v_net_amount,
    v_fee_amount,
    v_net_amount,
    'completed'::transaction_status,
    'Manual deposit - ' || v_request.currency || ' (' || v_request.network || ')',
    v_request.tx_hash,
    NOW()
  ) RETURNING id INTO v_transaction_id;

  UPDATE profiles
  SET
    main_wallet_balance = main_wallet_balance + v_net_amount,
    updated_at = NOW()
  WHERE id = v_request.user_id;

  -- TODO: Process referral commissions (function needs to be created)
  -- PERFORM process_referral_commissions(v_request.user_id, v_net_amount);

  UPDATE deposit_requests
  SET
    status = 'approved',
    processed_by = p_admin_id,
    processed_at = NOW(),
    admin_notes = p_admin_notes,
    updated_at = NOW()
  WHERE id = p_request_id;

  v_result := json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'amount', v_request.amount,
    'fee', v_fee_amount,
    'net_amount', v_net_amount,
    'user_id', v_request.user_id
  );

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;
