import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase, type BankAccount } from '@/lib/supabase';
import { formatInr, formatUsdt, formatDate, maskAccountNumber, maskTronAddress } from '@/lib/utils';
import { Wallet, Plus, Building2, Trash2, Link2, X, CheckCircle2, Copy } from 'lucide-react';

export default function WalletPage() {
  const { profile, refreshProfile } = useAuth();
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [showAddBank, setShowAddBank] = useState(false);
  const [tronAddress, setTronAddress] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressSaved, setAddressSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  // Bank form state
  const [bankName, setBankName] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [upiId, setUpiId] = useState('');

  useEffect(() => {
    if (!profile) return;
    setTronAddress(profile.tron_address || '');
    supabase
      .from('bank_accounts')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setBankAccounts(data as BankAccount[]);
      });
  }, [profile]);

  async function saveTronAddress() {
    if (!profile) return;
    setSavingAddress(true);
    await supabase.from('profiles').update({ tron_address: tronAddress }).eq('id', profile.id);
    await refreshProfile();
    setSavingAddress(false);
    setAddressSaved(true);
    setTimeout(() => setAddressSaved(false), 2000);
  }

  async function addBankAccount(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    const { data } = await supabase
      .from('bank_accounts')
      .insert({
        user_id: profile.id,
        bank_name: bankName,
        account_holder: accountHolder,
        account_number: accountNumber,
        swift_bic: ifsc || null,
        iban: upiId || null,
        currency: 'INR',
      })
      .select()
      .maybeSingle();
    if (data) {
      setBankAccounts((prev) => [data as BankAccount, ...prev]);
      setShowAddBank(false);
      setBankName('');
      setAccountHolder('');
      setAccountNumber('');
      setIfsc('');
      setUpiId('');
    }
  }

  async function deleteBankAccount(id: string) {
    await supabase.from('bank_accounts').delete().eq('id', id);
    setBankAccounts((prev) => prev.filter((ba) => ba.id !== id));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Wallet & Account</h1>
        <p className="text-slate-500 mt-1">Manage your balances, TRC-20 address, and bank accounts</p>
      </div>

      {/* Balance cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="p-6 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-emerald-100">USDT Balance</span>
            <Wallet className="w-5 h-5 text-emerald-200" />
          </div>
          <p className="text-3xl font-bold">{formatUsdt(profile?.usdt_balance ?? 0)}</p>
          <p className="text-sm text-emerald-200 mt-1">Tether (TRC-20)</p>
        </div>
        <div className="p-6 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-blue-100">INR Balance</span>
            <Wallet className="w-5 h-5 text-blue-200" />
          </div>
          <p className="text-3xl font-bold">{formatInr(profile?.inr_balance ?? 0)}</p>
          <p className="text-sm text-blue-200 mt-1">Indian Rupee</p>
        </div>
      </div>

      {/* TRC-20 Address */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
            <Link2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">TRC-20 Wallet Address</h2>
            <p className="text-sm text-slate-500">Your Tron address for sending USDT deposits</p>
          </div>
        </div>

        <div className="space-y-3">
          <input
            type="text"
            value={tronAddress}
            onChange={(e) => setTronAddress(e.target.value)}
            placeholder="T... (your Tron wallet address)"
            className="w-full px-4 py-3 rounded-lg border border-slate-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {profile?.tron_address && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Current: {maskTronAddress(profile.tron_address)}
            </div>
          )}
          <button
            onClick={saveTronAddress}
            disabled={savingAddress || tronAddress === (profile?.tron_address || '')}
            className="px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition"
          >
            {savingAddress ? 'Saving…' : addressSaved ? 'Saved!' : 'Save address'}
          </button>
        </div>
      </div>

      {/* Bank accounts */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Bank Accounts</h2>
              <p className="text-sm text-slate-500">Receive INR payouts to your bank</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddBank(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>

        {bankAccounts.length === 0 ? (
          <div className="py-8 text-center">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No bank accounts linked</p>
            <p className="text-sm text-slate-400 mt-1">Add a bank account to receive INR payouts</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bankAccounts.map((ba) => (
              <div key={ba.id} className="flex items-center justify-between p-4 rounded-lg border border-slate-200 hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{ba.bank_name}</p>
                    <p className="text-xs text-slate-500">
                      {ba.account_holder} — {maskAccountNumber(ba.account_number)}
                      {ba.swift_bic && ` · IFSC: ${ba.swift_bic}`}
                      {ba.iban && ` · UPI: ${ba.iban}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => deleteBankAccount(ba.id)}
                  className="text-slate-400 hover:text-red-500 transition"
                >
                  <Trash2 className="w-4.5 h-4.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add bank modal */}
      {showAddBank && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowAddBank(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="font-semibold text-slate-900">Add bank account</h2>
              <button onClick={() => setShowAddBank(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={addBankAccount} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Bank name</label>
                <input type="text" required value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="State Bank of India" className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Account holder name</label>
                <input type="text" required value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} placeholder="Jane Doe" className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Account number</label>
                <input type="text" required value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="123456789012" className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">IFSC code</label>
                  <input type="text" value={ifsc} onChange={(e) => setIfsc(e.target.value)} placeholder="SBIN0001234" className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">UPI ID (optional)</label>
                  <input type="text" value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="name@bank" className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <button type="submit" className="w-full px-4 py-3 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 transition">
                Save bank account
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
