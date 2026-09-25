export function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatUsdt(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  }).format(amount);
}

export function formatRate(rate: number): string {
  return rate.toFixed(2);
}

export function formatDate(date: string | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function maskAccountNumber(number: string): string {
  if (number.length <= 4) return number;
  return `••••${number.slice(-4)}`;
}

export function maskTronAddress(address: string): string {
  if (!address || address.length < 12) return address || '—';
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_deposit: 'Awaiting Deposit',
  deposit_confirmed: 'Deposit Confirmed',
  executing: 'Processing Payout',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  pending_deposit: 'bg-amber-100 text-amber-700 border-amber-200',
  deposit_confirmed: 'bg-blue-100 text-blue-700 border-blue-200',
  executing: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
};

export const DEPOSIT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  detected: 'Detected on-chain',
  confirmed: 'Confirmed',
  failed: 'Failed',
};

export const DEPOSIT_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600 border-gray-200',
  detected: 'bg-blue-100 text-blue-700 border-blue-200',
  confirmed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
};

// USDT/INR market rate with slight random walk
// Base rate ~83.50 INR per USDT (approximate real-world rate)
const BASE_RATE = 83.5;
let currentRate = BASE_RATE;

export function getMarketRate(): number {
  const drift = (Math.random() - 0.5) * 0.15;
  currentRate = Math.max(82, Math.min(85, currentRate + drift));
  return currentRate;
}

export function calculateQuote(
  usdtAmount: number,
  marginBps = 80,
): { rate: number; totalInr: number } {
  const market = getMarketRate();
  const margin = marginBps / 10000;
  // For selling USDT, user gets slightly below market (we take a spread)
  const rate = market * (1 - margin);
  const totalInr = usdtAmount * rate;
  return { rate, totalInr };
}

// The platform's TRC-20 deposit address where users send USDT
export const PLATFORM_TRON_ADDRESS = 'TJnQ4K8mZx7Wp9rY2vF3dL5sB8cH1aE6gQ';
