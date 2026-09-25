import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase, type Order, type Transaction } from '@/lib/supabase';
import { formatInr, formatUsdt, formatRate, formatDate, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, DEPOSIT_STATUS_LABELS, DEPOSIT_STATUS_COLORS } from '@/lib/utils';
import { TrendingUp, Wallet, FileText, ArrowUpRight, ArrowDownRight, Activity, Zap, Link2 } from 'lucide-react';

export default function Dashboard() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    Promise.all([
      supabase.from('orders').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(5),
      supabase.from('transactions').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(5),
    ]).then(([ordersRes, txRes]) => {
      if (ordersRes.data) setOrders(ordersRes.data as Order[]);
      if (txRes.data) setTransactions(txRes.data as Transaction[]);
      setLoading(false);
    });
  }, [profile]);

  const completedCount = orders.filter((o) => o.status === 'completed').length;
  const totalVolume = orders.filter((o) => o.status === 'completed').reduce((sum, o) => sum + Number(o.total_inr), 0);
  const pendingCount = orders.filter((o) => o.status === 'pending_deposit' || o.status === 'deposit_confirmed' || o.status === 'executing').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome back, {profile?.full_name?.split(' ')[0] || 'Trader'}
        </h1>
        <p className="text-slate-500 mt-1">Sell USDT for INR — fast, secure, on-chain</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'USDT Balance', value: formatUsdt(profile?.usdt_balance ?? 0), sub: 'Available to sell', icon: Wallet, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'INR Balance', value: formatInr(profile?.inr_balance ?? 0), sub: 'Available for withdrawal', icon: Wallet, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Total Volume', value: formatInr(totalVolume), sub: `${completedCount} completed`, icon: TrendingUp, color: 'text-slate-700', bg: 'bg-slate-100' },
          { label: 'Active Orders', value: pendingCount.toString(), sub: `${orders.length} total`, icon: FileText, color: 'text-slate-700', bg: 'bg-slate-100' },
        ].map((s) => (
          <div key={s.label} className="p-5 rounded-xl bg-white border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-500">{s.label}</span>
              <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center`}>
                <s.icon className={`w-4.5 h-4.5 ${s.color}`} />
              </div>
            </div>
            <p className="text-xl font-bold text-slate-900">{s.value}</p>
            <p className="text-xs text-slate-400 mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Quick sell CTA */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white">
          <h2 className="text-lg font-semibold">Ready to sell USDT?</h2>
          <p className="text-slate-400 text-sm mt-1">Get an instant INR quote. Send USDT on TRC-20, receive INR to your bank account.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/app/trade" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-400 transition">
              <TrendingUp className="w-4 h-4" />
              Sell USDT
            </Link>
          </div>
          <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-slate-400">Min trade</p>
              <p className="text-sm font-medium mt-0.5">100 USDT</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Max trade</p>
              <p className="text-sm font-medium mt-0.5">100,000 USDT</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Network</p>
              <p className="text-sm font-medium mt-0.5">TRC-20 (Tron)</p>
            </div>
          </div>
        </div>

        {/* TRC-20 address status */}
        <div className="p-6 rounded-xl bg-white border border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">TRC-20 Wallet</h2>
          {profile?.tron_address ? (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                <Link2 className="w-4 h-4 text-emerald-600" />
                <p className="text-xs font-mono text-emerald-700 break-all">{profile.tron_address}</p>
              </div>
              <p className="text-xs text-slate-400">Your USDT deposits will be verified from this address</p>
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-sm text-slate-500 mb-3">No TRC-20 address set. Add one to start selling.</p>
              <Link to="/app/wallet" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition">
                Set address
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Recent orders */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Recent Orders</h2>
          <Link to="/app/orders" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            View all →
          </Link>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No orders yet</p>
              <Link to="/app/trade" className="mt-3 inline-block text-sm text-blue-600 hover:text-blue-700 font-medium">
                Sell your first USDT →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Order</th>
                    <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">USDT</th>
                    <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Rate</th>
                    <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">INR Total</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Deposit</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3.5 text-sm font-medium text-slate-900">{o.order_number}</td>
                      <td className="px-5 py-3.5 text-sm text-slate-700 text-right">{formatUsdt(Number(o.usdt_amount))}</td>
                      <td className="px-5 py-3.5 text-sm text-slate-700 text-right">₹{formatRate(Number(o.rate))}</td>
                      <td className="px-5 py-3.5 text-sm font-medium text-slate-900 text-right">{formatInr(Number(o.total_inr))}</td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${ORDER_STATUS_COLORS[o.status]}`}>
                          {ORDER_STATUS_LABELS[o.status]}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${DEPOSIT_STATUS_COLORS[o.deposit_status]}`}>
                          {DEPOSIT_STATUS_LABELS[o.deposit_status]}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-500">{formatDate(o.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Recent transactions */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Transactions</h2>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
          ) : transactions.length === 0 ? (
            <div className="p-12 text-center">
              <Activity className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No transactions yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${Number(tx.amount) >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                      {Number(tx.amount) >= 0 ? <ArrowDownRight className="w-4.5 h-4.5 text-emerald-600" /> : <ArrowUpRight className="w-4.5 h-4.5 text-red-500" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 capitalize">{tx.type.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-slate-400">{formatDate(tx.created_at)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${Number(tx.amount) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {Number(tx.amount) >= 0 ? '+' : ''}{tx.asset === 'USDT' ? formatUsdt(Number(tx.amount)) : formatInr(Number(tx.amount))} {tx.asset}
                    </p>
                    <p className="text-xs text-slate-400 capitalize">{tx.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
