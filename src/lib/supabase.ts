import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    debug: false,
    storage: window.localStorage,
    storageKey: 'usdt-otc-auth',
  },
});

export type Profile = {
  id: string;
  full_name: string;
  phone: string;
  role: 'customer' | 'admin' | 'compliance' | 'treasury';
  usdt_balance: number;
  inr_balance: number;
  tron_address: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Quote = {
  id: string;
  user_id: string;
  side: 'sell';
  usdt_amount: number;
  rate: number;
  margin_bps: number;
  total_inr: number;
  total_usd: number;
  expires_at: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  created_at: string;
};

export type Order = {
  id: string;
  order_number: string;
  user_id: string;
  side: 'sell';
  usdt_amount: number;
  rate: number;
  total_inr: number;
  total_usd: number;
  status: 'pending_deposit' | 'deposit_confirmed' | 'executing' | 'completed' | 'cancelled' | 'rejected';
  quote_id: string | null;
  bank_account_id: string | null;
  deposit_reference: string | null;
  deposit_confirmed_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  rejection_reason: string | null;
  compliance_notes: string | null;
  tx_hash: string | null;
  deposit_status: 'pending' | 'detected' | 'confirmed' | 'failed';
  deposit_amount: number | null;
  deposit_confirmations: number;
  created_at: string;
  updated_at: string;
};

export type BankAccount = {
  id: string;
  user_id: string;
  bank_name: string;
  account_holder: string;
  account_number: string;
  iban: string | null;
  swift_bic: string | null;
  currency: string;
  is_verified: boolean;
  created_at: string;
};

export type Transaction = {
  id: string;
  user_id: string;
  order_id: string | null;
  type: 'deposit' | 'withdrawal' | 'trade_sell' | 'fee' | 'adjustment';
  asset: 'USDT' | 'INR';
  amount: number;
  balance_after: number | null;
  status: 'pending' | 'confirmed' | 'failed';
  tx_hash: string | null;
  description: string | null;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'order' | 'compliance' | 'system' | 'payment';
  is_read: boolean;
  link: string | null;
  created_at: string;
};

export type DepositScan = {
  id: string;
  tx_hash: string;
  from_address: string | null;
  to_address: string | null;
  amount: number;
  confirmations: number;
  status: 'detected' | 'confirmed' | 'failed';
  block_number: number | null;
  scanned_at: string;
  matched_order_id: string | null;
  matched_user_id: string | null;
};
