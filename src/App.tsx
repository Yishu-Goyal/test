import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import AppLayout from '@/components/AppLayout';
import LandingPage from '@/pages/LandingPage';
import AuthPage from '@/pages/AuthPage';
import Dashboard from '@/pages/Dashboard';
import TradePage from '@/pages/TradePage';
import OrdersPage from '@/pages/OrdersPage';
import WalletPage from '@/pages/WalletPage';
import AdminPage from '@/pages/AdminPage';
import type { ReactNode } from 'react';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-400 text-sm">Loading…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <AppLayout>{children}</AppLayout>;
;

}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/app" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/app/trade" element={<ProtectedRoute><TradePage /></ProtectedRoute>} />
          <Route path="/app/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
          <Route path="/app/wallet" element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
          <Route path="/app/bank-accounts" element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
          <Route path="/app/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
