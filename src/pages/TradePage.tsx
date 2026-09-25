import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase, type Quote, type BankAccount } from '@/lib/supabase';
import { calculateQuote, formatInr, formatUsdt, formatRate, getMarketRate, PLATFORM_TRON_ADDRESS } from '@/lib/utils';
import { TrendingUp, Clock, CheckCircle2, ArrowRight, AlertCircle, Link2, Copy, Zap, ShieldCheck, QrCode } from 'lucide-react';

type Step = 'quote' | 'deposit' | 'verifying' | 'success';

export default function TradePage() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [usdtAmount, setUsdtAmount] = useState<string>('1000');
  const [quote, setQuote] = useState<{ rate: number; totalInr: number } | null>(null);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [step, setStep] = useState<Step>('quote');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBank, setSelectedBank] = useState<string>('');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string>('');
  const [txHash, setTxHash] = useState('');
  const [verifyStatus, setVerifyStatus] = useState<string>('');
  const [marketRate, setMarketRate] = useState(getMarketRate());
  const [copied, setCopied] = useState(false);

  const amount = parseFloat(usdtAmount) || 0;
  const minTrade = 100;
  const maxTrade = 100000;

  useEffect(() => {
    const interval = setInterval(() => {
      setMarketRate(getMarketRate());
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const generateQuote = useCallback(async () => {
    if (amount < minTrade || amount > maxTrade) {
      setQuote(null);
      setSecondsLeft(0);
      return;
    }
    const result = calculateQuote(amount, 80);
    setQuote(result);

    const expiry = new Date(Date.now() + 30_000);
    setExpiresAt(expiry);
    setSecondsLeft(30);

    if (profile) {
      const { data } = await supabase
        .from('quotes')
        .insert({
          user_id: profile.id,
          side: 'sell',
          usdt_amount: amount,
          rate: result.rate,
          margin_bps: 80,
          total_inr: result.totalInr,
          total_usd: 0,
          expires_at: expiry.toISOString(),
          status: 'pending',
        })
        .select()
        .maybeSingle();
      if (data) setQuoteId(data.id);
    }
  }, [amount, profile]);

  useEffect(() => {
    const timeout = setTimeout(generateQuote, 400);
    return () => clearTimeout(timeout);
  }, [generateQuote]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          generateQuote();
          return 30;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsLeft, generateQuote]);

  useEffect(() => {
    if (profile) {
      supabase
        .from('bank_accounts')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          if (data) {
            setBankAccounts(data as BankAccount[]);
            if (data.length > 0) setSelectedBank(data[0].id);
          }
        });
    }
  }, [profile]);

  function copyAddress() {
    navigator.clipboard.writeText(PLATFORM_TRON_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function acceptQuote() {
    if (!profile || !quote || !quoteId) return;
    setLoading(true);
    setError(null);

    try {
      await supabase.from('quotes').update({ status: 'accepted' }).eq('id', quoteId);

      const { data: orderNum } = await supabase.rpc('generate_order_number');

      const { data, error: insertError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNum,
          user_id: profile.id,
          side: 'sell',
          usdt_amount: amount,
          rate: quote.rate,
          total_inr: quote.totalInr,
          total_usd: 0,
          status: 'pending_deposit',
          quote_id: quoteId,
          bank_account_id: selectedBank || null,
          deposit_reference: `MERIDIAN-${orderNum}`,
          deposit_status: 'pending',
        })
        .select()
        .maybeSingle();

      if (insertError) throw insertError;
      if (data) {
        setOrderId(data.id);
        setOrderNumber(data.order_number);

        await supabase.from('notifications').insert({
          user_id: profile.id,
          title: 'Sell order created',
          message: `Your sell order for ${formatUsdt(amount)} USDT has been created. Send USDT to the platform address on TRC-20 to proceed.`,
          type: 'order',
          link: '/app/orders',
        });

        setStep('deposit');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place order');
    } finally {
      setLoading(false);
    }
  }

  async function verifyDeposit() {
    if (!profile || !orderId || !txHash) return;
    setStep('verifying');
    setError(null);
    setVerifyStatus('Checking Tron network for your deposit…');

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-trc20-deposit`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          txHash,
          orderId,
          userAddress: profile.tron_address,
        }),
      });

      if (!response.ok) {
        throw new Error(`Verification request failed (${response.status})`);
      }

      const result = await response.json();

      if (result.verified && result.confirmed) {
        setVerifyStatus('Deposit confirmed on-chain! Your order is being processed.');
        await supabase.from('notifications').insert({
          user_id: profile.id,
          title: 'Deposit confirmed',
          message: `Your USDT deposit has been verified on TRC-20. Order ${orderNumber} is being processed for INR payout.`,
          type: 'payment',
          link: '/app/orders',
        });
        setStep('success');
      } else if (result.verified && !result.confirmed) {
        setVerifyStatus(`Deposit detected! Waiting for confirmations (${result.confirmations}/19). Please check back shortly.`);
        setError('Your deposit was found but needs more block confirmations. You can check back in a few minutes.');
      } else {
        setVerifyStatus(result.error || 'Could not verify deposit. Please check your transaction hash.');
        setError(result.error || 'Could not verify deposit. Make sure you sent USDT on TRC-20 to the correct address.');
        setStep('deposit');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify deposit');
      setStep('deposit');
    }
  }

  // ===== SUCCESS =====
  if (step === 'success') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Deposit confirmed!</h1>
          <p className="text-slate-500 mt-2">
            Your sell order for {formatUsdt(amount)} USDT is now being processed. INR payout of {formatInr(quote?.totalInr ?? 0)} will be sent to your bank account.
          </p>

          <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-left">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Order number</p>
                <p className="font-medium text-slate-900 mt-0.5">{orderNumber}</p>
              </div>
              <div>
                <p className="text-slate-500">Rate</p>
                <p className="font-medium text-slate-900 mt-0.5">₹{formatRate(quote?.rate ?? 0)}</p>
              </div>
              <div>
                <p className="text-slate-500">INR Payout</p>
                <p className="font-medium text-slate-900 mt-0.5">{formatInr(quote?.totalInr ?? 0)}</p>
              </div>
              <div>
                <p className="text-slate-500">Tx Hash</p>
                <p className="font-mono text-xs text-slate-900 mt-0.5 truncate">{txHash}</p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex gap-3 justify-center">
            <button onClick={() => navigate('/app/orders')} className="px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition">
              View orders
            </button>
            <button onClick={() => { setStep('quote'); setQuoteId(null); setOrderId(null); setTxHash(''); }} className="px-5 py-2.5 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition">
              New trade
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== VERIFYING =====
  if (step === 'verifying') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-6 animate-pulse">
            <Zap className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Verifying deposit…</h1>
          <p className="text-slate-500 mt-2">{verifyStatus}</p>
          <div className="mt-6 w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
          <p className="text-xs text-slate-400 mt-4">Checking Tron network for your TRC-20 transaction</p>
        </div>
      </div>
    );
  }

  // ===== DEPOSIT STEP =====
  if (step === 'deposit') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Send your USDT</h1>
          <p className="text-slate-500 mt-1">Transfer USDT on TRC-20 to the platform address</p>
        </div>

        {/* Deposit instructions */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Link2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-medium text-slate-900">Platform TRC-20 Address</p>
              <p className="text-sm text-slate-500">Send USDT (TRC-20) to this address</p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-900 text-white">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-sm break-all">{PLATFORM_TRON_ADDRESS}</p>
              <button onClick={copyAddress} className="flex-shrink-0 p-2 rounded-lg bg-white/10 hover:bg-white/20 transition">
                {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="mt-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Amount to send</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{formatUsdt(amount)} USDT</p>
            <p className="text-sm text-slate-500 mt-1">You'll receive: {formatInr(quote?.totalInr ?? 0)}</p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider">Network</p>
              <p className="text-sm font-medium text-slate-900 mt-1">TRC-20 (Tron)</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider">Reference</p>
              <p className="text-sm font-medium text-slate-900 mt-1">MERIDIAN-{orderNumber}</p>
            </div>
          </div>

          <div className="mt-4 p-4 rounded-lg bg-amber-50 border border-amber-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-700">
                <p className="font-medium">Important:</p>
                <ul className="mt-1 space-y-0.5">
                  <li>Only send USDT on the TRC-20 (Tron) network</li>
                  <li>Sending on other networks will result in permanent loss</li>
                  <li>Minimum 19 block confirmations required</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* TX hash input */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-2">Enter transaction hash</h2>
          <p className="text-sm text-slate-500 mb-4">After sending USDT, paste your Tron transaction hash here for auto-verification</p>

          <input
            type="text"
            value={txHash}
            onChange={(e) => setTxHash(e.target.value)}
            placeholder="e.g. a1b2c3d4e5f6... (Tron tx hash)"
            className="w-full px-4 py-3 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {error && (
            <div className="mt-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            onClick={verifyDeposit}
            disabled={!txHash || loading}
            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 disabled:opacity-50 transition"
          >
            <ShieldCheck className="w-4 h-4" />
            Verify deposit on TRC-20
          </button>
        </div>
      </div>
    );
  }

  // ===== QUOTE STEP =====
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Sell USDT for INR</h1>
        <p className="text-slate-500 mt-1">Get an instant quote — send USDT on TRC-20, receive INR</p>
      </div>

      {/* Amount input */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          USDT amount to sell
        </label>
        <div className="relative">
          <input
            type="number"
            value={usdtAmount}
            onChange={(e) => setUsdtAmount(e.target.value)}
            placeholder="1000"
            className="w-full px-4 py-4 pr-16 rounded-lg border border-slate-200 text-2xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">USDT</span>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-slate-400">Min: {formatUsdt(minTrade)} · Max: {formatUsdt(maxTrade)}</span>
          {amount > 0 && amount < minTrade && <span className="text-red-500">Below minimum</span>}
          {amount > maxTrade && <span className="text-red-500">Above maximum</span>}
        </div>

        <div className="mt-4 flex gap-2">
          {['500', '1000', '5000', '10000'].map((amt) => (
            <button
              key={amt}
              onClick={() => setUsdtAmount(amt)}
              className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200 transition"
            >
              {formatUsdt(parseFloat(amt))}
            </button>
          ))}
        </div>
      </div>

      {/* Quote display */}
      {quote && amount >= minTrade && amount <= maxTrade && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Your quote</h2>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-slate-400" />
              <span className={secondsLeft <= 5 ? 'text-red-500 font-medium' : 'text-slate-500'}>
                {secondsLeft}s
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-slate-50">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Market rate</p>
              <p className="text-lg font-semibold text-slate-900 mt-1">₹{formatRate(marketRate)}</p>
            </div>
            <div className="p-4 rounded-lg bg-blue-50">
              <p className="text-xs text-blue-600 uppercase tracking-wider">Your rate</p>
              <p className="text-lg font-semibold text-blue-900 mt-1">₹{formatRate(quote.rate)}</p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">You receive</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{formatInr(quote.totalInr)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500">Spread</p>
              <p className="text-sm font-medium text-slate-700 mt-1">80 bps</p>
            </div>
          </div>

          {/* Bank account selection */}
          {bankAccounts.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <label className="block text-sm font-medium text-slate-700 mb-2">Receive INR to</label>
              <select
                value={selectedBank}
                onChange={(e) => setSelectedBank(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {bankAccounts.map((ba) => (
                  <option key={ba.id} value={ba.id}>
                    {ba.bank_name} — ••••{ba.account_number.slice(-4)}
                  </option>
                ))}
              </select>
            </div>
          )}
          {bankAccounts.length === 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-sm text-amber-600">
                No bank account linked. Add one in your wallet to receive INR payouts.
              </p>
            </div>
          )}

          <button
            onClick={acceptQuote}
            disabled={loading}
            className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 disabled:opacity-50 transition"
          >
            {loading ? 'Placing order…' : 'Accept quote & place sell order'}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      )}

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
