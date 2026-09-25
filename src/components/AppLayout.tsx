import { useState, useEffect, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase, type Notification } from '@/lib/supabase';
import { TrendingUp, LayoutDashboard, Wallet, FileText, Bell, Banknote, ShieldCheck, LogOut, Menu, X, type LucideIcon } from 'lucide-react';
import { formatUsdt, timeAgo } from '@/lib/utils';

type NavItem = { to: string; label: string; icon: LucideIcon; adminOnly?: boolean };

const NAV_ITEMS: NavItem[] = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/app/trade', label: 'New Trade', icon: TrendingUp },
  { to: '/app/orders', label: 'Orders', icon: FileText },
  { to: '/app/wallet', label: 'Wallet', icon: Wallet },
  { to: '/app/bank-accounts', label: 'Bank Accounts', icon: Banknote },
  { to: '/app/admin', label: 'Admin Panel', icon: ShieldCheck, adminOnly: true },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotif, setShowNotif] = useState(false);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'compliance' || profile?.role === 'treasury';
  const navItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) setNotifications(data as Notification[]);
      });
  }, [profile, location.pathname]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  async function markAllRead() {
    if (!profile) return;
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-slate-900 text-white flex flex-col transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-16 flex items-center justify-between px-5 border-b border-white/10">
          <Link to="/app" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="font-semibold tracking-tight">Meridian OTC</span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  active ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <item.icon className="w-4.5 h-4.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10">
          <div className="px-3 py-2 mb-2">
            <p className="text-sm font-medium text-white truncate">{profile?.full_name || 'User'}</p>
            <p className="text-xs text-slate-400 capitalize">{profile?.role}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition"
          >
            <LogOut className="w-4.5 h-4.5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-20">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-600">
            <Menu className="w-5 h-5" />
          </button>

          <div className="hidden sm:block">
            <p className="text-sm text-slate-500">
              {NAV_ITEMS.find((n) => location.pathname === n.to)?.label || 'Dashboard'}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Balance pill */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100">
              <span className="text-sm text-slate-500">USDT</span>
              <span className="text-sm font-semibold text-slate-900">
                {formatUsdt(profile?.usdt_balance ?? 0)}
              </span>
            </div>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => { setShowNotif(!showNotif); if (!showNotif) markAllRead(); }}
                className="relative p-2 rounded-lg hover:bg-slate-100 transition"
              >
                <Bell className="w-5 h-5 text-slate-600" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
                )}
              </button>
              {showNotif && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowNotif(false)} />
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-200 z-40 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <p className="font-semibold text-slate-900 text-sm">Notifications</p>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="px-4 py-8 text-center text-sm text-slate-400">No notifications yet</p>
                      ) : (
                        notifications.map((n) => (
                          <div key={n.id} className="px-4 py-3 border-b border-slate-50 hover:bg-slate-50">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-medium text-slate-900">{n.title}</p>
                                <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                              </div>
                              <span className="text-xs text-slate-400 flex-shrink-0">{timeAgo(n.created_at)}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-white text-sm font-medium">
              {(profile?.full_name || 'U')[0].toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
