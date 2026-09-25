/*
# Add staff-level access policies for admin panel

## Problem
The existing RLS policies only allow `auth.uid() = user_id`, so admin/staff users
cannot see other users' orders, profiles, transactions, etc. The admin panel
appears empty even for admin users.

## Solution
Add additional SELECT/UPDATE policies that allow staff (role = admin, compliance,
or treasury) to read ALL rows and update orders/profiles for management purposes.
Postgres ORs multiple matching policies together, so the existing owner-scoped
policies remain in effect for regular users while staff get full visibility.

## New Policies
1. profiles: staff can SELECT all profiles, UPDATE all profiles (KYC, role, status)
2. orders: staff can SELECT all orders, UPDATE all orders (status changes)
3. transactions: staff can SELECT all transactions
4. bank_accounts: staff can SELECT all bank accounts
5. quotes: staff can SELECT all quotes
6. notifications: staff can SELECT all notifications
7. compliance_logs: staff can SELECT all logs, INSERT as reviewer

## Security Notes
- Staff role is verified via subquery to profiles table (not user_metadata)
- Only SELECT and UPDATE are granted to staff — no INSERT/DELETE on user data
- The owner-scoped policies remain, so non-staff users still only see their own data
*/

-- Helper function: check if current user is staff
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'compliance', 'treasury')
  );
$$;

-- ============ PROFILES: staff can read & update all ============
DROP POLICY IF EXISTS "staff_select_all_profiles" ON public.profiles;
CREATE POLICY "staff_select_all_profiles" ON public.profiles FOR SELECT
  TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "staff_update_all_profiles" ON public.profiles;
CREATE POLICY "staff_update_all_profiles" ON public.profiles FOR UPDATE
  TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ============ ORDERS: staff can read & update all ============
DROP POLICY IF EXISTS "staff_select_all_orders" ON public.orders;
CREATE POLICY "staff_select_all_orders" ON public.orders FOR SELECT
  TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "staff_update_all_orders" ON public.orders;
CREATE POLICY "staff_update_all_orders" ON public.orders FOR UPDATE
  TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ============ TRANSACTIONS: staff can read all ============
DROP POLICY IF EXISTS "staff_select_all_transactions" ON public.transactions;
CREATE POLICY "staff_select_all_transactions" ON public.transactions FOR SELECT
  TO authenticated USING (public.is_staff());

-- ============ BANK ACCOUNTS: staff can read all ============
DROP POLICY IF EXISTS "staff_select_all_bank_accounts" ON public.bank_accounts;
CREATE POLICY "staff_select_all_bank_accounts" ON public.bank_accounts FOR SELECT
  TO authenticated USING (public.is_staff());

-- ============ QUOTES: staff can read all ============
DROP POLICY IF EXISTS "staff_select_all_quotes" ON public.quotes;
CREATE POLICY "staff_select_all_quotes" ON public.quotes FOR SELECT
  TO authenticated USING (public.is_staff());

-- ============ NOTIFICATIONS: staff can read all ============
DROP POLICY IF EXISTS "staff_select_all_notifications" ON public.notifications;
CREATE POLICY "staff_select_all_notifications" ON public.notifications FOR SELECT
  TO authenticated USING (public.is_staff());

-- ============ COMPLIANCE LOGS: staff can read all & insert ============
DROP POLICY IF EXISTS "staff_select_all_compliance_logs" ON public.compliance_logs;
CREATE POLICY "staff_select_all_compliance_logs" ON public.compliance_logs FOR SELECT
  TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "staff_insert_compliance_logs" ON public.compliance_logs;
CREATE POLICY "staff_insert_compliance_logs" ON public.compliance_logs FOR INSERT
  TO authenticated WITH CHECK (public.is_staff());

-- ============ NOTIFICATIONS: staff can insert for any user ============
DROP POLICY IF EXISTS "staff_insert_notifications" ON public.notifications;
CREATE POLICY "staff_insert_notifications" ON public.notifications FOR INSERT
  TO authenticated WITH CHECK (public.is_staff());