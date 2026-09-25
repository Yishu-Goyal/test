import { Link } from 'react-router-dom';
import { TrendingUp, ArrowRight, ShieldCheck, Zap, Globe, BarChart3, Lock } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-slate-900 tracking-tight">Meridian OTC</span>
          </div>
          <div className="flex items-center gap-8">
            <a href="#features" className="text-sm text-slate-600 hover:text-slate-900 hidden sm:block">Features</a>
            <a href="#how" className="text-sm text-slate-600 hover:text-slate-900 hidden sm:block">How it works</a>
            <a href="#security" className="text-sm text-slate-600 hover:text-slate-900 hidden sm:block">Security</a>
            <Link
              to="/auth"
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition"
            >
              Sign in
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live trading desk — open for business
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-slate-900 leading-tight">
            Trade USDT with the confidence of an
            <span className="block mt-1 bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">
              institutional trading desk
            </span>
          </h1>
          <p className="mt-6 text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Transparent OTC pricing, deep liquidity, and full compliance built in.
            Execute block trades from $10K to $10M with zero slippage.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 transition group"
            >
              Start trading
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition"
            >
              Learn more
            </a>
          </div>

          {/* Stats bar */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto">
            {[
              { label: 'Monthly volume', value: '$840M+' },
              { label: 'Active clients', value: '2,400+' },
              { label: 'Avg. settlement', value: '< 2 hours' },
              { label: 'Uptime', value: '99.98%' },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-3xl font-bold text-slate-900">{s.value}</p>
                <p className="text-sm text-slate-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900">Built for serious traders</h2>
            <p className="mt-3 text-slate-500 text-lg">Everything you need to execute and settle large USDT trades</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Zap, title: 'Instant RFQ pricing', desc: 'Request quotes for any size. Live rates with 30-second holds. No slippage, ever.' },
              { icon: ShieldCheck, title: 'Compliance built-in', desc: 'KYC verification, transaction monitoring, and audit trails on every trade.' },
              { icon: Globe, title: 'Multi-rail settlement', desc: 'Wire transfer, SEPA, and on-chain USDT delivery. Choose what works for you.' },
              { icon: BarChart3, title: 'Real-time dashboard', desc: 'Track orders, balances, and transaction history with full transparency.' },
              { icon: Lock, title: 'Bank-grade security', desc: 'Row-level security, encrypted storage, and multi-layer access controls.' },
              { icon: TrendingUp, title: 'Best-price execution', desc: 'Tight spreads with transparent margin. See exactly what you pay.' },
            ].map((f) => (
              <div key={f.title} className="p-6 rounded-2xl bg-white border border-slate-200 hover:shadow-lg hover:border-slate-300 transition">
                <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center mb-4">
                  <f.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-slate-900 text-lg">{f.title}</h3>
                <p className="mt-2 text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900">How it works</h2>
            <p className="mt-3 text-slate-500 text-lg">From quote to settlement in four steps</p>
          </div>
          <div className="space-y-8">
            {[
              { step: '01', title: 'Create your account', desc: 'Register and complete KYC verification. Get approved in minutes.' },
              { step: '02', title: 'Request a quote', desc: 'Enter your trade size. Get a live rate with transparent margin. Hold for 30 seconds.' },
              { step: '03', title: 'Place your order', desc: 'Accept the quote. Choose your settlement method. Wire, SEPA, or on-chain.' },
              { step: '04', title: 'Settle and receive', desc: 'Confirm your deposit. We execute the trade and deliver USDT to your wallet.' },
            ].map((s) => (
              <div key={s.step} className="flex gap-6 items-start">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold">{s.step}</span>
                </div>
                <div className="pt-2">
                  <h3 className="font-semibold text-slate-900 text-lg">{s.title}</h3>
                  <p className="mt-1 text-slate-500">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="py-20 px-6 bg-slate-900">
        <div className="max-w-4xl mx-auto text-center">
          <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-white">Security is not optional</h2>
          <p className="mt-4 text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
            Every account is protected by row-level security. Every trade is logged for compliance.
            Every transaction is encrypted at rest and in transit.
          </p>
          <Link
            to="/auth"
            className="mt-10 inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white text-slate-900 font-medium hover:bg-slate-100 transition group"
          >
            Get started
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-slate-100">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span className="font-medium text-slate-700">Meridian OTC</span>
          </div>
          <p className="text-sm text-slate-400">
            © 2026 Meridian OTC. All rights reserved. Trading digital assets carries risk.
          </p>
        </div>
      </footer>
    </div>
  );
}
