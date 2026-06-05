// src/pages/InvestPage.jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { investmentAPI, walletAPI } from '../services/api';
import Layout from '../components/layout/Layout';

const fmtINR = (n) =>
  `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function InvestPage() {
  const [plans,       setPlans]       = useState([]);
  const [investments, setInvestments] = useState([]);
  const [balance,     setBalance]     = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [buying,      setBuying]      = useState(null); // plan id being bought
  const [amounts,     setAmounts]     = useState({});
  const [tab,         setTab]         = useState('plans');

  useEffect(() => {
    Promise.allSettled([
      investmentAPI.getPlans(),
      investmentAPI.getMine(),
      walletAPI.getBalance(),
    ]).then(([p, i, b]) => {
      if (p.status === 'fulfilled') setPlans(p.value.data.data);
      if (i.status === 'fulfilled') setInvestments(i.value.data.data);
      if (b.status === 'fulfilled') setBalance(b.value.data.data);
    }).finally(() => setLoading(false));
  }, []);

  const handleBuy = async (plan) => {
    const amount = parseFloat(amounts[plan.id] || plan.min_amount);
    if (!amount || amount < plan.min_amount) {
      toast.error(`Minimum for ${plan.name} is ${fmtINR(plan.min_amount)}`);
      return;
    }
    setBuying(plan.id);
    try {
      const { data } = await investmentAPI.buy({ plan_id: plan.id, amount });
      toast.success(data.message);
      // Refresh
      const [i, b] = await Promise.all([investmentAPI.getMine(), walletAPI.getBalance()]);
      setInvestments(i.data.data);
      setBalance(b.data.data);
      setTab('mine');
      setAmounts({});
    } catch (err) {
      toast.error(err.response?.data?.message || 'Purchase failed');
    } finally {
      setBuying(null);
    }
  };

  const now = new Date();

  return (
    <Layout>
      <div className="max-w-lg mx-auto px-4 py-5">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5 pt-1">
          <Link to="/dashboard"
            className="w-9 h-9 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
            ←
          </Link>
          <div>
            <h1 className="text-xl font-black text-white">Investment Plans</h1>
            <p className="text-gray-500 text-xs">Grow your money with fixed returns</p>
          </div>
        </div>

        {/* Balance pill */}
        {balance && (
          <div className="rounded-2xl bg-emerald-900/20 border border-emerald-800/30 px-4 py-3 mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Available Balance</p>
              <p className="text-lg font-black text-emerald-400">{fmtINR(balance.balance_inr)}</p>
            </div>
            <span className="text-2xl">💰</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {[{ id: 'plans', label: 'Plans' }, { id: 'mine', label: `My Investments (${investments.length})` }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${tab === t.id ? 'bg-emerald-600 text-white' : 'bg-gray-900 border border-gray-800 text-gray-400 hover:bg-gray-800'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Plans tab */}
        {tab === 'plans' && (
          <div className="space-y-4">
            {loading ? (
              [...Array(2)].map((_, i) => <div key={i} className="h-48 bg-gray-900 rounded-2xl animate-pulse" />)
            ) : plans.map((plan) => (
              <div key={plan.id}
                className={`card rounded-2xl overflow-hidden border ${plan.slug === 'premium' ? 'border-yellow-700/50' : 'border-emerald-700/30'}`}>
                {plan.slug === 'premium' && (
                  <div className="bg-gradient-to-r from-yellow-600 to-amber-500 px-4 py-1.5 text-center">
                    <p className="text-white text-xs font-black tracking-wide">⭐ PREMIUM PLAN</p>
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-white font-black text-lg">{plan.name}</h3>
                      <p className="text-gray-400 text-sm mt-0.5">{plan.description}</p>
                    </div>
                    <div className={`text-2xl font-black ${plan.slug === 'premium' ? 'text-yellow-400' : 'text-emerald-400'}`}>
                      {plan.return_pct}%
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-5">
                    <div className="bg-gray-800/60 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">Lock Period</p>
                      <p className="font-black text-white">{plan.lock_days}d</p>
                    </div>
                    <div className="bg-gray-800/60 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">Return</p>
                      <p className={`font-black ${plan.slug === 'premium' ? 'text-yellow-400' : 'text-emerald-400'}`}>{plan.return_pct}%</p>
                    </div>
                    <div className="bg-gray-800/60 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">Min Invest</p>
                      <p className="font-black text-white">₹{parseFloat(plan.min_amount).toLocaleString('en-IN')}</p>
                    </div>
                  </div>

                  {/* Example calculation */}
                  {amounts[plan.id] && parseFloat(amounts[plan.id]) >= plan.min_amount && (
                    <div className="bg-gray-800/40 rounded-xl p-3 mb-4 border border-gray-700/50">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">You invest:</span>
                        <span className="text-white font-bold">{fmtINR(amounts[plan.id])}</span>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-gray-400">Profit ({plan.return_pct}%):</span>
                        <span className="text-emerald-400 font-bold">
                          +{fmtINR(parseFloat(amounts[plan.id]) * plan.return_pct / 100)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm mt-1 pt-1 border-t border-gray-700">
                        <span className="text-gray-300 font-semibold">You receive:</span>
                        <span className="text-emerald-400 font-black">
                          {fmtINR(parseFloat(amounts[plan.id]) * (1 + plan.return_pct / 100))}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="relative mb-3">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                    <input
                      type="number"
                      min={plan.min_amount}
                      step="1"
                      className="input pl-8"
                      placeholder={`Min ₹${parseFloat(plan.min_amount).toLocaleString('en-IN')}`}
                      value={amounts[plan.id] || ''}
                      onChange={e => setAmounts(prev => ({ ...prev, [plan.id]: e.target.value }))}
                    />
                  </div>

                  <button
                    onClick={() => handleBuy(plan)}
                    disabled={buying === plan.id}
                    className={`w-full py-3 rounded-xl font-black text-sm transition-all active:scale-95 ${
                      plan.slug === 'premium'
                        ? 'bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-400 text-white'
                        : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white'
                    }`}>
                    {buying === plan.id ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Processing...
                      </span>
                    ) : `Invest in ${plan.name} →`}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* My investments tab */}
        {tab === 'mine' && (
          <div className="space-y-3">
            {loading ? (
              [...Array(3)].map((_, i) => <div key={i} className="h-24 bg-gray-900 rounded-2xl animate-pulse" />)
            ) : investments.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-4xl mb-3">📊</p>
                <p className="text-gray-400 font-semibold">No investments yet</p>
                <button onClick={() => setTab('plans')} className="mt-4 text-sm text-emerald-400 hover:text-emerald-300 font-bold">
                  View Plans →
                </button>
              </div>
            ) : investments.map((inv) => {
              const lockedUntil   = new Date(inv.locked_until);
              const isMatured     = now >= lockedUntil;
              const hoursLeft     = Math.max(0, Math.ceil((lockedUntil - now) / 3600000));
              const daysLeft      = Math.floor(hoursLeft / 24);
              const timeLabel     = daysLeft > 0 ? `${daysLeft}d ${hoursLeft % 24}h left` : `${hoursLeft}h left`;

              return (
                <div key={inv.id} className={`card rounded-2xl p-4 border ${
                  inv.status === 'completed' ? 'border-emerald-800/30 bg-emerald-900/10'
                  : isMatured ? 'border-yellow-700/40 bg-yellow-900/10'
                  : 'border-gray-800'
                }`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-black text-white">{inv.plan_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(inv.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </p>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      inv.status === 'completed' ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-800'
                      : isMatured ? 'bg-yellow-900/40 text-yellow-400 border border-yellow-800'
                      : 'bg-blue-900/40 text-blue-400 border border-blue-800'
                    }`}>
                      {inv.status === 'completed' ? '✅ Paid' : isMatured ? '🔔 Matured' : '🔒 Active'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-gray-800/50 rounded-xl p-2">
                      <p className="text-xs text-gray-500">Invested</p>
                      <p className="text-sm font-bold text-white">₹{parseFloat(inv.amount).toLocaleString('en-IN')}</p>
                    </div>
                    <div className="bg-gray-800/50 rounded-xl p-2">
                      <p className="text-xs text-gray-500">Profit</p>
                      <p className="text-sm font-bold text-emerald-400">+₹{parseFloat(inv.profit_amount).toLocaleString('en-IN')}</p>
                    </div>
                    <div className="bg-gray-800/50 rounded-xl p-2">
                      <p className="text-xs text-gray-500">{inv.status === 'completed' ? 'Received' : isMatured ? 'Ready' : 'Unlocks'}</p>
                      <p className={`text-xs font-bold ${inv.status === 'completed' || isMatured ? 'text-emerald-400' : 'text-gray-300'}`}>
                        {inv.status === 'completed' ? `₹${parseFloat(inv.total_payout).toLocaleString('en-IN')}` : isMatured ? 'Pending' : timeLabel}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
