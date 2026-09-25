import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase, type Order } from '@/lib/supabase';
import { formatInr, formatUsdt, formatRate, formatDate, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, DEPOSIT_STATUS_LABELS, DEPOSIT_STATUS_COLORS } from '@/lib/utils';
import { FileText, ArrowUpRight, Search, X, Link2 } from 'lucide-react';

type Filter = 'all' | 'pending_deposit' | 'deposit_confirmed' | 'completed' | 'cancelled';

export default function OrdersPage() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('orders')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setOrders(data as Order[]);
        setLoading(false);
      });
  }, [profile]);

  const filtered = orders.filter((o) => {
    if (filter === 'pending_deposit' && o.status !== 'pending_deposit') return false;
    if (filter === 'deposit_confirmed' && o.status !== 'deposit_confirmed' && o.status !== 'executing') return false;
    if (filter === 'completed' && o.status !== 'completed') return false;
    if (filter === 'cancelled' && o.status !== 'cancelled' && o.status !== 'rejected') return false;
    if (search && !o.order_number.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function cancelOrder(order: Order) {
    if (!profile) return;
    await supabase
      .from('orders')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', order.id);
    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, status: 'cancelled', cancelled_at: new Date().toISOString() } : o))
    );
    await supabase.from('notifications').insert({
      user_id: profile.id,
      title: 'Order cancelled',
      message: `Order ${order.order_number} has been cancelled.`,
      type: 'order',
    });
    setSelectedOrder(null);
  }

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending_deposit', label: 'Awaiting Deposit' },
    { key: 'deposit_confirmed', label: 'Processing' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
        <p className="text-slate-500 mt-1">Track your USDT sell orders</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by order number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                filter === f.key
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No orders found</p>
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
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedOrder(o)}>
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
                    <td className="px-5 py-3.5 text-right">
                      <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order detail drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedOrder(null)} />
          <div className="relative w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Order details</h2>
              <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Order number</p>
                <p className="text-xl font-bold text-slate-900 mt-1">{selectedOrder.order_number}</p>
              </div>

              <div className="flex items-center gap-3">
                <span className={`px-3 py-1.5 rounded-full text-sm font-medium border ${ORDER_STATUS_COLORS[selectedOrder.status]}`}>
                  {ORDER_STATUS_LABELS[selectedOrder.status]}
                </span>
                <span className={`px-3 py-1.5 rounded-full text-sm font-medium border ${DEPOSIT_STATUS_COLORS[selectedOrder.deposit_status]}`}>
                  {DEPOSIT_STATUS_LABELS[selectedOrder.deposit_status]}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50">
                <div>
                  <p className="text-xs text-slate-500">USDT amount</p>
                  <p className="text-lg font-semibold text-slate-900 mt-1">{formatUsdt(Number(selectedOrder.usdt_amount))}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Rate</p>
                  <p className="text-lg font-semibold text-slate-900 mt-1">₹{formatRate(Number(selectedOrder.rate))}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">INR payout</p>
                  <p className="text-lg font-semibold text-slate-900 mt-1">{formatInr(Number(selectedOrder.total_inr))}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Reference</p>
                  <p className="text-sm font-medium text-slate-900 mt-1">{selectedOrder.deposit_reference || '—'}</p>
                </div>
              </div>

              {/* TRC-20 deposit info */}
              {selectedOrder.tx_hash && (
                <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Link2 className="w-4 h-4 text-emerald-600" />
                    <p className="text-xs font-medium text-emerald-700 uppercase">TRC-20 Deposit Verified</p>
                  </div>
                  <p className="text-xs font-mono text-slate-600 break-all">{selectedOrder.tx_hash}</p>
                  {selectedOrder.deposit_amount && (
                    <p className="text-sm text-emerald-700 mt-2">
                      Deposited: {formatUsdt(Number(selectedOrder.deposit_amount))} USDT · {selectedOrder.deposit_confirmations} confirmations
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Created</span>
                  <span className="text-slate-900">{formatDate(selectedOrder.created_at)}</span>
                </div>
                {selectedOrder.deposit_confirmed_at && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Deposit confirmed</span>
                    <span className="text-slate-900">{formatDate(selectedOrder.deposit_confirmed_at)}</span>
                  </div>
                )}
                {selectedOrder.completed_at && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Completed</span>
                    <span className="text-slate-900">{formatDate(selectedOrder.completed_at)}</span>
                  </div>
                )}
                {selectedOrder.rejection_reason && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-xs text-red-600 font-medium">Rejection reason</p>
                    <p className="text-sm text-red-700 mt-1">{selectedOrder.rejection_reason}</p>
                  </div>
                )}
              </div>

              {selectedOrder.status === 'pending_deposit' && (
                <button
                  onClick={() => cancelOrder(selectedOrder)}
                  className="w-full px-4 py-2.5 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition"
                >
                  Cancel order
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
