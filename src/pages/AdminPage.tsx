import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase, type Order, type Profile, type Transaction, type BankAccount, type DepositScan } from '@/lib/supabase';
import { formatInr, formatUsdt, formatRate, formatDate, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, DEPOSIT_STATUS_LABELS, DEPOSIT_STATUS_COLORS } from '@/lib/utils';
import {
  ShieldCheck, Search, X, CheckCircle2, XCircle, Clock, Users, DollarSign,
  TrendingUp, Link2, Wallet, Ban, Building2, RefreshCw, ArrowUpRight,
} from 'lucide-react';

type Tab = 'overview' | 'orders' | 'deposits' | 'users' | 'transactions';

type OrderWithUser = Order & { user_name?: string };
type TxWithUser = Transaction & { user_name?: string };
type ScanWithUser = DepositScan & { user_name?: string; order_number?: string };

export default function AdminPage() {
  const { profile, refreshProfile } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [orders, setOrders] = useState<OrderWithUser[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [transactions, setTransactions] = useState<TxWithUser[]>([]);
  const [scans, setScans] = useState<ScanWithUser[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<OrderWithUser | null>(null);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [complianceNote, setComplianceNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustAsset, setAdjustAsset] = useState<'USDT' | 'INR'>('USDT');
  const [adjustNote, setAdjustNote] = useState('');

  const isAdmin = profile?.role === 'admin' || profile?.role === 'compliance' || profile?.role === 'treasury';

  const loadData = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    const [ordersRes, profilesRes, txRes, bankRes, scansRes] = await Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('bank_accounts').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('deposit_scans').select('*').order('scanned_at', { ascending: false }).limit(200),
    ]);

    const profileMap = new Map<string, string>();
    if (profilesRes.data) {
      (profilesRes.data as Profile[]).forEach((p) => profileMap.set(p.id, p.full_name || 'Unknown'));
    }

    if (ordersRes.data) setOrders((ordersRes.data as Order[]).map((o) => ({ ...o, user_name: profileMap.get(o.user_id) || 'Unknown' })));
    if (profilesRes.data) setProfiles(profilesRes.data as Profile[]);
    if (txRes.data) setTransactions((txRes.data as Transaction[]).map((t) => ({ ...t, user_name: profileMap.get(t.user_id) || 'Unknown' })));
    if (bankRes.data) setBankAccounts(bankRes.data as BankAccount[]);
    if (scansRes.data) {
      const orderMap = new Map<string, string>();
      (ordersRes.data as Order[]).forEach((o) => orderMap.set(o.id, o.order_number));
      setScans((scansRes.data as DepositScan[]).map((s) => ({
        ...s,
        user_name: s.matched_user_id ? (profileMap.get(s.matched_user_id) || 'Unknown') : '—',
        order_number: s.matched_order_id ? (orderMap.get(s.matched_order_id) || '—') : '—',
      })));
    }
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => { loadData(); }, [loadData]);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">You don't have access to the admin panel.</p>
        </div>
      </div>
    );
  }

  const filteredOrders = orders.filter((o) => {
    if (orderFilter !== 'all' && o.status !== orderFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return o.order_number.toLowerCase().includes(q) || (o.user_name?.toLowerCase().includes(q) ?? false);
    }
    return true;
  });

  const filteredUsers = profiles.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (p.full_name?.toLowerCase().includes(q) ?? false) || p.role.includes(q);
  });

  const filteredTx = transactions.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (t.user_name?.toLowerCase().includes(q) ?? false) || t.type.includes(q) || t.asset.toLowerCase().includes(q);
  });

  const pendingOrders = orders.filter((o) => o.status === 'pending_deposit' || o.status === 'deposit_confirmed' || o.status === 'executing');
  const completedOrders = orders.filter((o) => o.status === 'completed');
  const totalVolume = completedOrders.reduce((sum, o) => sum + Number(o.total_inr), 0);
  const totalUsers = profiles.length;
  const totalUsdtInSystem = profiles.reduce((sum, p) => sum + Number(p.usdt_balance), 0);
  const totalInrInSystem = profiles.reduce((sum, p) => sum + Number(p.inr_balance), 0);
  const pendingDeposits = scans.filter((s) => s.status === 'detected');

  async function updateOrderStatus(order: OrderWithUser, status: Order['status'], notes?: string) {
    setActionLoading(true);
    setActionError(null);
    try {
      const updates: Partial<Order> = { status };
      if (status === 'completed') updates.completed_at = new Date().toISOString();
      if (status === 'rejected') updates.rejection_reason = notes || 'Rejected by admin';
      if (notes) updates.compliance_notes = notes;

      const { error: updateError } = await supabase.from('orders').update(updates).eq('id', order.id);
      if (updateError) throw updateError;

      if (profile) {
        await supabase.from('compliance_logs').insert({
          order_id: order.id,
          user_id: order.user_id,
          reviewer_id: profile.id,
          action: status === 'completed' ? 'approve' : status === 'rejected' ? 'reject' : 'review',
          notes: notes || null,
        });
      }

      if (status === 'completed') {
        await supabase.from('transactions').insert({
          user_id: order.user_id,
          order_id: order.id,
          type: 'trade_sell',
          asset: 'INR',
          amount: Number(order.total_inr),
          status: 'confirmed',
          description: `INR payout for selling ${formatUsdt(Number(order.usdt_amount))} USDT at ₹${formatRate(Number(order.rate))}`,
        });
      }

      await supabase.from('notifications').insert({
        user_id: order.user_id,
        title: status === 'completed' ? 'Order completed' : status === 'rejected' ? 'Order rejected' : 'Order updated',
        message:
          status === 'completed'
            ? `Your order ${order.order_number} has been completed. INR ${formatInr(Number(order.total_inr))} has been sent to your bank account.`
            : status === 'rejected'
            ? `Your order ${order.order_number} has been rejected. ${notes || ''}`
            : `Your order ${order.order_number} status has been updated to ${ORDER_STATUS_LABELS[status]}.`,
        type: status === 'completed' ? 'order' : 'compliance',
        link: '/app/orders',
      });

      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, ...updates } : o)));
      setSelectedOrder(null);
      setComplianceNote('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update order');
    } finally {
      setActionLoading(false);
    }
  }

  async function changeUserRole(userId: string, role: string) {
    setActionLoading(true);
    try {
      await supabase.from('profiles').update({ role }).eq('id', userId);
      setProfiles((prev) => prev.map((p) => p.id === userId ? { ...p, role: role as Profile['role'] } : p));
      if (userId === profile?.id) await refreshProfile();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setActionLoading(false);
    }
  }

  async function toggleUserActive(userId: string, currentActive: boolean) {
    setActionLoading(true);
    try {
      await supabase.from('profiles').update({ is_active: !currentActive }).eq('id', userId);
      setProfiles((prev) => prev.map((p) => p.id === userId ? { ...p, is_active: !currentActive } : p));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setActionLoading(false);
    }
  }

  async function adjustBalance(userId: string) {
    const amount = parseFloat(adjustAmount);
    if (!amount || !selectedUser) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const col = adjustAsset === 'USDT' ? 'usdt_balance' : 'inr_balance';
      const currentVal = adjustAsset === 'USDT' ? Number(selectedUser.usdt_balance) : Number(selectedUser.inr_balance);
      const newVal = currentVal + amount;
      if (newVal < 0) { setActionError('Resulting balance cannot be negative'); setActionLoading(false); return; }

      await supabase.from('profiles').update({ [col]: newVal }).eq('id', userId);
      await supabase.from('transactions').insert({
        user_id: userId,
        type: 'adjustment',
        asset: adjustAsset,
        amount: amount,
        balance_after: newVal,
        status: 'confirmed',
        description: adjustNote || `Manual ${amount > 0 ? 'credit' : 'debit'} by admin`,
      });
      await supabase.from('notifications').insert({
        user_id: userId,
        title: 'Balance adjusted',
        message: `Your ${adjustAsset} balance has been ${amount > 0 ? 'increased' : 'decreased'} by ${adjustAsset === 'USDT' ? formatUsdt(Math.abs(amount)) : formatInr(Math.abs(amount))}. ${adjustNote || ''}`,
        type: 'system',
      });

      setProfiles((prev) => prev.map((p) => p.id === userId ? { ...p, [col]: newVal } : p));
      setSelectedUser((prev) => prev ? { ...prev, [col]: newVal } : prev);
      setAdjustAmount('');
      setAdjustNote('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to adjust balance');
    } finally {
      setActionLoading(false);
    }
  }

  async function manualVerifyDeposit(scan: ScanWithUser) {
    setActionLoading(true);
    try {
      await supabase.from('deposit_scans').update({ status: 'confirmed' }).eq('id', scan.id);
      if (scan.matched_order_id) {
        await supabase.from('orders').update({
          status: 'deposit_confirmed',
          deposit_status: 'confirmed',
          deposit_confirmed_at: new Date().toISOString(),
          tx_hash: scan.tx_hash,
          deposit_amount: Number(scan.amount),
          deposit_confirmations: scan.confirmations,
        }).eq('id', scan.matched_order_id);
        setOrders((prev) => prev.map((o) => o.id === scan.matched_order_id ? { ...o, status: 'deposit_confirmed', deposit_status: 'confirmed', deposit_confirmed_at: new Date().toISOString(), tx_hash: scan.tx_hash, deposit_amount: Number(scan.amount), deposit_confirmations: scan.confirmations } : o));
      }
      setScans((prev) => prev.map((s) => s.id === scan.id ? { ...s, status: 'confirmed' } : s)));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to verify deposit');
    } finally {
      setActionLoading(false);
    }
  }

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'orders', label: 'Orders' },
    { key: 'deposits', label: 'TRC-20 Deposits', badge: pendingDeposits.length },
    { key: 'users', label: 'Users' },
    { key: 'transactions', label: 'Transactions' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Panel</h1>
          <p className="text-slate-500 mt-1">USDT/INR trading desk management</p>
        </div>
        <button onClick={loadData} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {actionError && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ===== OVERVIEW ===== */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Users', value: totalUsers.toString(), sub: 'Registered', icon: Users, color: 'text-slate-700', bg: 'bg-slate-100' },
              { label: 'Pending Orders', value: pendingOrders.length.toString(), sub: 'Need action', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'INR Volume', value: formatInr(totalVolume), sub: `${completedOrders.length} completed`, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Pending Deposits', value: pendingDeposits.length.toString(), sub: 'TRC-20 detected', icon: Link2, color: 'text-blue-600', bg: 'bg-blue-50' },
            ].map((s) => (
              <div key={s.label} className="p-5 rounded-xl bg-white border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-slate-500">{s.label}</span>
                  <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center`}><s.icon className={`w-4.5 h-4.5 ${s.color}`} /></div>
                </div>
                <p className="text-xl font-bold text-slate-900">{s.value}</p>
                <p className="text-xs text-slate-400 mt-1">{s.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="p-6 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
              <div className="flex items-center justify-between mb-3"><span className="text-sm text-emerald-100">Total USDT in System</span><Wallet className="w-5 h-5 text-emerald-200" /></div>
              <p className="text-3xl font-bold">{formatUsdt(totalUsdtInSystem)}</p>
              <p className="text-sm text-emerald-200 mt-1">Across all wallets</p>
            </div>
            <div className="p-6 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <div className="flex items-center justify-between mb-3"><span className="text-sm text-blue-100">Total INR in System</span><DollarSign className="w-5 h-5 text-blue-200" /></div>
              <p className="text-3xl font-bold">{formatInr(totalInrInSystem)}</p>
              <p className="text-sm text-blue-200 mt-1">Across all accounts</p>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Orders</h2>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {loading ? <div className="p-12 text-center text-slate-400 text-sm">Loading…</div> : orders.length === 0 ? <div className="p-12 text-center text-slate-400">No orders yet</div> : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead><tr className="border-b border-slate-100">
                      <th className="text-left text-xs font-medium text-slate-500 uppercase px-5 py-3">Order</th>
                      <th className="text-left text-xs font-medium text-slate-500 uppercase px-5 py-3">User</th>
                      <th className="text-right text-xs font-medium text-slate-500 uppercase px-5 py-3">USDT</th>
                      <th className="text-right text-xs font-medium text-slate-500 uppercase px-5 py-3">INR</th>
                      <th className="text-left text-xs font-medium text-slate-500 uppercase px-5 py-3">Status</th>
                      <th className="text-left text-xs font-medium text-slate-500 uppercase px-5 py-3">Deposit</th>
                      <th className="text-left text-xs font-medium text-slate-500 uppercase px-5 py-3">Date</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-50">
                      {orders.slice(0, 8).map((o) => (
                        <tr key={o.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => { setSelectedOrder(o); setTab('orders'); }}>
                          <td className="px-5 py-3.5 text-sm font-medium text-slate-900">{o.order_number}</td>
                          <td className="px-5 py-3.5 text-sm text-slate-600">{o.user_name}</td>
                          <td className="px-5 py-3.5 text-sm text-slate-700 text-right">{formatUsdt(Number(o.usdt_amount))}</td>
                          <td className="px-5 py-3.5 text-sm font-medium text-slate-900 text-right">{formatInr(Number(o.total_inr))}</td>
                          <td className="px-5 py-3.5"><span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${ORDER_STATUS_COLORS[o.status]}`}>{ORDER_STATUS_LABELS[o.status]}</span></td>
                          <td className="px-5 py-3.5"><span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${DEPOSIT_STATUS_COLORS[o.deposit_status]}`}>{DEPOSIT_STATUS_LABELS[o.deposit_status]}</span></td>
                          <td className="px-5 py-3.5 text-sm text-slate-500">{formatDate(o.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== TABS ===== */}
      {tab !== 'overview' && (
        <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap flex items-center gap-2 ${tab === t.key ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {t.label}
              {t.badge !== undefined && t.badge > 0 && <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold">{t.badge}</span>}
            </button>
          ))}
        </div>
      )}

      {/* ===== ORDERS ===== */}
      {tab === 'orders' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
              <input type="text" placeholder="Search by order or user…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-11 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <select value={orderFilter} onChange={(e) => setOrderFilter(e.target.value)} className="px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="all">All statuses</option>
              <option value="pending_deposit">Awaiting Deposit</option>
              <option value="deposit_confirmed">Deposit Confirmed</option>
              <option value="executing">Processing</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {loading ? <div className="p-12 text-center text-slate-400 text-sm">Loading…</div> : filteredOrders.length === 0 ? <div className="p-12 text-center text-slate-400">No orders found</div> : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-slate-100">
                    <th className="text-left text-xs font-medium text-slate-500 uppercase px-5 py-3">Order</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase px-5 py-3">User</th>
                    <th className="text-right text-xs font-medium text-slate-500 uppercase px-5 py-3">USDT</th>
                    <th className="text-right text-xs font-medium text-slate-500 uppercase px-5 py-3">Rate</th>
                    <th className="text-right text-xs font-medium text-slate-500 uppercase px-5 py-3">INR</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase px-5 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase px-5 py-3">Deposit</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase px-5 py-3">Date</th>
                    <th className="px-5 py-3"></th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedOrder(o)}>
                        <td className="px-5 py-3.5 text-sm font-medium text-slate-900">{o.order_number}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-600">{o.user_name}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-700 text-right">{formatUsdt(Number(o.usdt_amount))}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-700 text-right">₹{formatRate(Number(o.rate))}</td>
                        <td className="px-5 py-3.5 text-sm font-medium text-slate-900 text-right">{formatInr(Number(o.total_inr))}</td>
                        <td className="px-5 py-3.5"><span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${ORDER_STATUS_COLORS[o.status]}`}>{ORDER_STATUS_LABELS[o.status]}</span></td>
                        <td className="px-5 py-3.5"><span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${DEPOSIT_STATUS_COLORS[o.deposit_status]}`}>{DEPOSIT_STATUS_LABELS[o.deposit_status]}</span></td>
                        <td className="px-5 py-3.5 text-sm text-slate-500">{formatDate(o.created_at)}</td>
                        <td className="px-5 py-3.5 text-right"><button className="text-sm text-blue-600 hover:text-blue-700 font-medium">Review</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== DEPOSITS ===== */}
      {tab === 'deposits' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading ? <div className="p-12 text-center text-slate-400 text-sm">Loading…</div> : scans.length === 0 ? (
            <div className="p-12 text-center">
              <Link2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No TRC-20 deposits detected yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-slate-100">
                  <th className="text-left text-xs font-medium text-slate-500 uppercase px-5 py-3">Tx Hash</th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase px-5 py-3">User</th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase px-5 py-3">Order</th>
                  <th className="text-right text-xs font-medium text-slate-500 uppercase px-5 py-3">Amount</th>
                  <th className="text-right text-xs font-medium text-slate-500 uppercase px-5 py-3">Confirms</th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase px-5 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase px-5 py-3">Scanned</th>
                  <th className="px-5 py-3"></th>
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {scans.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3.5 text-sm font-mono text-slate-900 max-w-[180px] truncate">{s.tx_hash}</td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">{s.user_name}</td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">{s.order_number}</td>
                      <td className="px-5 py-3.5 text-sm font-medium text-slate-900 text-right">{formatUsdt(Number(s.amount))}</td>
                      <td className="px-5 py-3.5 text-sm text-slate-700 text-right">{s.confirmations}</td>
                      <td className="px-5 py-3.5"><span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${DEPOSIT_STATUS_COLORS[s.status]}`}>{DEPOSIT_STATUS_LABELS[s.status]}</span></td>
                      <td className="px-5 py-3.5 text-sm text-slate-500">{formatDate(s.scanned_at)}</td>
                      <td className="px-5 py-3.5 text-right">
                        {s.status === 'detected' && (
                          <button onClick={() => manualVerifyDeposit(s)} disabled={actionLoading} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium disabled:opacity-50">
                            Confirm
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===== USERS ===== */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
            <input type="text" placeholder="Search users…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full max-w-md pl-11 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {loading ? <div className="p-12 text-center text-slate-400 text-sm">Loading…</div> : filteredUsers.length === 0 ? <div className="p-12 text-center text-slate-400">No users found</div> : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-slate-100">
                    <th className="text-left text-xs font-medium text-slate-500 uppercase px-5 py-3">Name</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase px-5 py-3">Role</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase px-5 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase px-5 py-3">TRC-20 Address</th>
                    <th className="text-right text-xs font-medium text-slate-500 uppercase px-5 py-3">USDT</th>
                    <th className="text-right text-xs font-medium text-slate-500 uppercase px-5 py-3">INR</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase px-5 py-3">Joined</th>
                    <th className="px-5 py-3"></th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredUsers.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedUser(p)}>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-white text-xs font-medium">{(p.full_name || 'U')[0].toUpperCase()}</div>
                            <span className="text-sm font-medium text-slate-900">{p.full_name || '—'}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <select value={p.role} onClick={(e) => e.stopPropagation()} onChange={(e) => changeUserRole(p.id, e.target.value)} disabled={actionLoading || p.id === profile?.id} className="px-2 py-1 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 capitalize">
                            <option value="customer">customer</option><option value="admin">admin</option><option value="compliance">compliance</option><option value="treasury">treasury</option>
                          </select>
                        </td>
                        <td className="px-5 py-3.5">
                          <button onClick={(e) => { e.stopPropagation(); toggleUserActive(p.id, p.is_active); }} disabled={actionLoading || p.id === profile?.id} className={`inline-flex items-center gap-1.5 text-xs font-medium ${p.is_active ? 'text-emerald-600' : 'text-red-500'} disabled:opacity-50`}>
                            {p.is_active ? <><span className="w-2 h-2 rounded-full bg-emerald-500" /> Active</> : <><Ban className="w-3 h-3" /> Suspended</>}
                          </button>
                        </td>
                        <td className="px-5 py-3.5 text-sm font-mono text-slate-500 max-w-[150px] truncate">{p.tron_address || '—'}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-700 text-right">{formatUsdt(Number(p.usdt_balance))}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-700 text-right">{formatInr(Number(p.inr_balance))}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-500">{formatDate(p.created_at)}</td>
                        <td className="px-5 py-3.5 text-right"><button className="text-sm text-blue-600 hover:text-blue-700 font-medium">Manage</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== TRANSACTIONS ===== */}
      {tab === 'transactions' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
            <input type="text" placeholder="Search by user, type, or asset…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full max-w-md pl-11 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {loading ? <div className="p-12 text-center text-slate-400 text-sm">Loading…</div> : filteredTx.length === 0 ? <div className="p-12 text-center text-slate-400">No transactions found</div> : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-slate-100">
                    <th className="text-left text-xs font-medium text-slate-500 uppercase px-5 py-3">User</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase px-5 py-3">Type</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase px-5 py-3">Asset</th>
                    <th className="text-right text-xs font-medium text-slate-500 uppercase px-5 py-3">Amount</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase px-5 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase px-5 py-3">Description</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase px-5 py-3">Date</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredTx.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3.5 text-sm font-medium text-slate-900">{t.user_name}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-700 capitalize">{t.type.replace(/_/g, ' ')}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-700">{t.asset}</td>
                        <td className={`px-5 py-3.5 text-sm font-medium text-right ${Number(t.amount) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{Number(t.amount) >= 0 ? '+' : ''}{t.asset === 'USDT' ? formatUsdt(Number(t.amount)) : formatInr(Number(t.amount))}</td>
                        <td className="px-5 py-3.5"><span className={`px-2 py-1 rounded-full text-xs font-medium ${t.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : t.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{t.status}</span></td>
                        <td className="px-5 py-3.5 text-sm text-slate-500 max-w-xs truncate">{t.description || '—'}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-500">{formatDate(t.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== ORDER DRAWER ===== */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedOrder(null)} />
          <div className="relative w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div><h2 className="font-semibold text-slate-900">Review order</h2><p className="text-xs text-slate-500 mt-0.5">{selectedOrder.user_name}</p></div>
              <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-5">
              <div><p className="text-xs text-slate-500 uppercase">Order</p><p className="text-xl font-bold text-slate-900 mt-1">{selectedOrder.order_number}</p></div>
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50">
                <div><p className="text-xs text-slate-500">USDT</p><p className="text-sm font-medium text-slate-900 mt-1">{formatUsdt(Number(selectedOrder.usdt_amount))}</p></div>
                <div><p className="text-xs text-slate-500">Rate</p><p className="text-sm font-medium text-slate-900 mt-1">₹{formatRate(Number(selectedOrder.rate))}</p></div>
                <div><p className="text-xs text-slate-500">INR Payout</p><p className="text-sm font-medium text-slate-900 mt-1">{formatInr(Number(selectedOrder.total_inr))}</p></div>
                <div><p className="text-xs text-slate-500">Status</p><p className="text-sm font-medium text-slate-900 mt-1">{ORDER_STATUS_LABELS[selectedOrder.status]}</p></div>
              </div>

              {selectedOrder.tx_hash && (
                <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                  <div className="flex items-center gap-2 mb-2"><Link2 className="w-4 h-4 text-emerald-600" /><p className="text-xs font-medium text-emerald-700 uppercase">TRC-20 Deposit</p></div>
                  <p className="text-xs font-mono text-slate-600 break-all">{selectedOrder.tx_hash}</p>
                  {selectedOrder.deposit_amount && <p className="text-sm text-emerald-700 mt-2">{formatUsdt(Number(selectedOrder.deposit_amount))} USDT · {selectedOrder.deposit_confirmations} confirmations</p>}
                </div>
              )}

              <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Admin notes</label><textarea value={complianceNote} onChange={(e) => setComplianceNote(e.target.value)} rows={3} placeholder="Add notes…" className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>

              <div className="space-y-2">
                {selectedOrder.status === 'pending_deposit' && (
                  <button onClick={() => updateOrderStatus(selectedOrder, 'deposit_confirmed', complianceNote)} disabled={actionLoading} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"><CheckCircle2 className="w-4 h-4" /> Confirm deposit</button>
                )}
                {selectedOrder.status === 'deposit_confirmed' && (
                  <>
                    <button onClick={() => updateOrderStatus(selectedOrder, 'completed', complianceNote)} disabled={actionLoading} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition"><CheckCircle2 className="w-4 h-4" /> Complete & send INR</button>
                    <button onClick={() => updateOrderStatus(selectedOrder, 'rejected', complianceNote)} disabled={actionLoading} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 disabled:opacity-50 transition"><XCircle className="w-4 h-4" /> Reject</button>
                  </>
                )}
                {(selectedOrder.status === 'completed' || selectedOrder.status === 'rejected' || selectedOrder.status === 'cancelled') && (
                  <div className="p-3 rounded-lg bg-slate-50 text-center text-sm text-slate-500">This order is {ORDER_STATUS_LABELS[selectedOrder.status].toLowerCase()}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== USER DRAWER ===== */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setSelectedUser(null); setAdjustAmount(''); setAdjustNote(''); }} />
          <div className="relative w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Manage user</h2>
              <button onClick={() => { setSelectedUser(null); setAdjustAmount(''); setAdjustNote(''); }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-white text-xl font-medium">{(selectedUser.full_name || 'U')[0].toUpperCase()}</div>
                <div><p className="font-semibold text-slate-900">{selectedUser.full_name || 'Unknown'}</p><p className="text-sm text-slate-500 capitalize">{selectedUser.role}</p></div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50">
                <div><p className="text-xs text-slate-500">USDT Balance</p><p className="text-lg font-bold text-slate-900 mt-1">{formatUsdt(Number(selectedUser.usdt_balance))}</p></div>
                <div><p className="text-xs text-slate-500">INR Balance</p><p className="text-lg font-bold text-slate-900 mt-1">{formatInr(Number(selectedUser.inr_balance))}</p></div>
              </div>

              {selectedUser.tron_address && (
                <div className="p-4 rounded-lg border border-slate-200">
                  <p className="text-sm font-medium text-slate-900 mb-1">TRC-20 Address</p>
                  <p className="text-xs font-mono text-slate-600 break-all">{selectedUser.tron_address}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Role</label>
                <select value={selectedUser.role} onChange={(e) => { changeUserRole(selectedUser.id, e.target.value); setSelectedUser({ ...selectedUser, role: e.target.value as Profile['role'] }); }} disabled={actionLoading || selectedUser.id === profile?.id} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 capitalize">
                  <option value="customer">Customer</option><option value="admin">Admin</option><option value="compliance">Compliance</option><option value="treasury">Treasury</option>
                </select>
              </div>

              <div className="p-4 rounded-lg border border-slate-200 space-y-3">
                <div className="flex items-center gap-2"><Wallet className="w-4 h-4 text-slate-600" /><p className="text-sm font-medium text-slate-900">Adjust balance</p></div>
                <div className="flex gap-2">
                  <select value={adjustAsset} onChange={(e) => setAdjustAsset(e.target.value as 'USDT' | 'INR')} className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="USDT">USDT</option><option value="INR">INR</option></select>
                  <input type="number" placeholder="Amount (+ or -)" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <input type="text" placeholder="Reason (optional)" value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button onClick={() => adjustBalance(selectedUser.id)} disabled={actionLoading || !adjustAmount} className="w-full px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition">Apply adjustment</button>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200">
                <div><p className="text-sm font-medium text-slate-900">Account Status</p><p className="text-xs text-slate-500 mt-0.5">{selectedUser.is_active ? 'Active and can trade' : 'Suspended'}</p></div>
                <button onClick={() => { toggleUserActive(selectedUser.id, selectedUser.is_active); setSelectedUser({ ...selectedUser, is_active: !selectedUser.is_active }); }} disabled={actionLoading || selectedUser.id === profile?.id} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-50 ${selectedUser.is_active ? 'border border-red-200 text-red-600 hover:bg-red-50' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>{selectedUser.is_active ? 'Suspend' : 'Reactivate'}</button>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Bank Accounts</p>
                {bankAccounts.filter((ba) => ba.user_id === selectedUser.id).length === 0 ? <p className="text-sm text-slate-400">No bank accounts linked</p> : (
                  <div className="space-y-2">
                    {bankAccounts.filter((ba) => ba.user_id === selectedUser.id).map((ba) => (
                      <div key={ba.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200"><Building2 className="w-4 h-4 text-slate-400" /><div><p className="text-sm font-medium text-slate-900">{ba.bank_name}</p><p className="text-xs text-slate-500">{ba.account_holder} — ••••{ba.account_number.slice(-4)}</p></div></div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
