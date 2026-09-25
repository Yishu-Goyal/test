/*
# USDT OTC Trading Platform - Database Schema

## Overview
Creates the full PostgreSQL schema for a USDT over-the-counter trading desk.
Users register, get live quotes, place buy/sell orders, deposit/withdraw USDT,
and staff manage orders, compliance, and reconciliation.

## New Tables
- profiles: extends auth.users with role, KYC status, USDT/cash balances
- bank_accounts: customer bank accounts for fiat transfers
- quotes: price quotes (rate + margin) given to users
- orders: trade orders created from accepted quotes
- transactions: ledger entries for every balance movement
- notifications: in-app notifications for users
- compliance_logs: audit trail for compliance reviews

## Security
- RLS enabled on all tables
- Owner-scoped CRUD policies for customer tables
- Auto-create profile on signup via trigger
- Auto-update updated_at via triggers
*/

-- ============ PROFILES ============
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text DEFAULT '',
  role text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin','compliance','treasury')),
  kyc_status text NOT NULL DEFAULT 'unverified' CHECK (kyc_status IN ('unverified','pending','verified','rejected')),
  kyc_submitted_at timestamptz,
  kyc_reviewed_at timestamptz,
  usdt_balance numeric(20,8) NOT NULL DEFAULT 0,
  cash_balance numeric(20,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON public.profiles;
CREATE POLICY "select_own_profile" ON public.profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
CREATE POLICY "update_own_profile" ON public.profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON public.profiles;
CREATE POLICY "insert_own_profile" ON public.profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

-- ============ BANK ACCOUNTS ============
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  bank_name text NOT NULL,
  account_holder text NOT NULL,
  account_number text NOT NULL,
  iban text,
  swift_bic text,
  currency text NOT NULL DEFAULT 'USD',
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_bank_accounts" ON public.bank_accounts;
CREATE POLICY "select_own_bank_accounts" ON public.bank_accounts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_bank_accounts" ON public.bank_accounts;
CREATE POLICY "insert_own_bank_accounts" ON public.bank_accounts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_bank_accounts" ON public.bank_accounts;
CREATE POLICY "update_own_bank_accounts" ON public.bank_accounts FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_bank_accounts" ON public.bank_accounts;
CREATE POLICY "delete_own_bank_accounts" ON public.bank_accounts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============ QUOTES ============
CREATE TABLE IF NOT EXISTS public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  side text NOT NULL CHECK (side IN ('buy','sell')),
  usdt_amount numeric(20,8) NOT NULL,
  rate numeric(20,8) NOT NULL,
  margin_bps integer NOT NULL DEFAULT 50,
  total_usd numeric(20,2) NOT NULL,
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','expired','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_quotes" ON public.quotes;
CREATE POLICY "select_own_quotes" ON public.quotes FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_quotes" ON public.quotes;
CREATE POLICY "insert_own_quotes" ON public.quotes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_quotes" ON public.quotes;
CREATE POLICY "update_own_quotes" ON public.quotes FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ ORDERS ============
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  side text NOT NULL CHECK (side IN ('buy','sell')),
  usdt_amount numeric(20,8) NOT NULL,
  rate numeric(20,8) NOT NULL,
  total_usd numeric(20,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending_deposit' CHECK (status IN ('pending_deposit','deposit_confirmed','executing','completed','cancelled','rejected')),
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  deposit_reference text,
  deposit_confirmed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  rejection_reason text,
  compliance_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_orders" ON public.orders;
CREATE POLICY "select_own_orders" ON public.orders FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_orders" ON public.orders;
CREATE POLICY "insert_own_orders" ON public.orders FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_orders" ON public.orders;
CREATE POLICY "update_own_orders" ON public.orders FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ TRANSACTIONS ============
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('deposit','withdrawal','trade_buy','trade_sell','fee','adjustment')),
  asset text NOT NULL CHECK (asset IN ('USDT','USD')),
  amount numeric(20,8) NOT NULL,
  balance_after numeric(20,8),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','failed')),
  tx_hash text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_transactions" ON public.transactions;
CREATE POLICY "select_own_transactions" ON public.transactions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_transactions" ON public.transactions;
CREATE POLICY "insert_own_transactions" ON public.transactions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============ NOTIFICATIONS ============
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'system' CHECK (type IN ('order','compliance','system','payment')),
  is_read boolean NOT NULL DEFAULT false,
  link text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_notifications" ON public.notifications;
CREATE POLICY "select_own_notifications" ON public.notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_notifications" ON public.notifications;
CREATE POLICY "update_own_notifications" ON public.notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_notifications" ON public.notifications;
CREATE POLICY "insert_own_notifications" ON public.notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============ COMPLIANCE LOGS ============
CREATE TABLE IF NOT EXISTS public.compliance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('review','approve','reject','flag','unflag')),
  notes text,
  risk_score integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.compliance_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_compliance_logs" ON public.compliance_logs;
CREATE POLICY "select_own_compliance_logs" ON public.compliance_logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR auth.uid() = reviewer_id);

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON public.quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON public.transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_id ON public.bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_compliance_logs_order_id ON public.compliance_logs(order_id);

-- ============ TRIGGER: auto-create profile on signup ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 'customer')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ TRIGGER: update updated_at ============
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON public.profiles;
CREATE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trigger_orders_updated_at ON public.orders;
CREATE TRIGGER trigger_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============ FUNCTION: generate order number ============
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  next_val integer;
  year_text text;
BEGIN
  year_text := EXTRACT(YEAR FROM now())::text;
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 11) AS integer)), 0) + 1
    INTO next_val
    FROM public.orders
    WHERE order_number LIKE 'ORD-' || year_text || '-%';
  RETURN 'ORD-' || year_text || '-' || lpad(next_val::text, 5, '0');
END;
$$;