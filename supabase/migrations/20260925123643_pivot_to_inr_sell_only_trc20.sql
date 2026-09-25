/*
# Pivot to USDT/INR sell-only platform with TRC-20 auto deposit verification

## Overview
Reworks the platform: users sell USDT for INR only (no buy side).
Deposits are received on-chain via TRC-20 (Tron network) and auto-verified.
KYC is removed entirely — no verification required to trade.

## Changes
### profiles: drop KYC columns, add tron_address + inr_balance
### orders: sell-only, add total_inr, tx_hash, deposit tracking fields
### quotes: sell-only, add total_inr
### transactions: add INR asset
### deposit_scans: new table for TRC-20 deposit monitoring
*/

-- ============ PROFILES ============
ALTER TABLE public.profiles DROP COLUMN IF EXISTS kyc_status;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS kyc_submitted_at;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS kyc_reviewed_at;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tron_address text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS inr_balance numeric(20,2) NOT NULL DEFAULT 0;

-- ============ ORDERS ============
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS total_inr numeric(20,2) NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tx_hash text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS deposit_status text NOT NULL DEFAULT 'pending' CHECK (deposit_status IN ('pending','detected','confirmed','failed'));
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS deposit_amount numeric(20,8);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS deposit_confirmations integer NOT NULL DEFAULT 0;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_side_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_side_check CHECK (side = 'sell');

-- ============ QUOTES ============
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS total_inr numeric(20,2) NOT NULL DEFAULT 0;

ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_side_check;
ALTER TABLE public.quotes ADD CONSTRAINT quotes_side_check CHECK (side = 'sell');

-- ============ TRANSACTIONS ============
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_asset_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_asset_check CHECK (asset IN ('USDT','INR'));

-- ============ DEPOSIT SCANS TABLE ============
CREATE TABLE IF NOT EXISTS public.deposit_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_hash text UNIQUE NOT NULL,
  from_address text,
  to_address text,
  amount numeric(20,8) NOT NULL,
  confirmations integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'detected' CHECK (status IN ('detected','confirmed','failed')),
  block_number bigint,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  matched_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  matched_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.deposit_scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_select_all_deposit_scans" ON public.deposit_scans;
CREATE POLICY "staff_select_all_deposit_scans" ON public.deposit_scans FOR SELECT
  TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "owner_select_deposit_scans" ON public.deposit_scans;
CREATE POLICY "owner_select_deposit_scans" ON public.deposit_scans FOR SELECT
  TO authenticated USING (matched_user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_deposit_scans_to_address ON public.deposit_scans(to_address);
CREATE INDEX IF NOT EXISTS idx_deposit_scans_status ON public.deposit_scans(status);