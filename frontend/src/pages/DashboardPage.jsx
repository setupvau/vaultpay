import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { walletAPI, broadcastAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/layout/Layout';

const fmtINR = (n) =>
  `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const LEDGER_META = {
  deposit_credit:   { label: 'Deposit',      icon: '⬇️', green: true  },
  deposit_bonus:    { label: 'Bonus',         icon: '🎁', green: true  },
  admin_credit:     { label: 'Credit',        icon: '💳', green: true  },
  admin_debit:      { label: 'Debit',         icon: '💳', green: false },
  profit_credit:    { label: 'Investment Return', icon: '📈', green: true },
  referral_bonus:   { label: 'Referral',      icon: '👥', green: true  },
  withdrawal_debit: { label: 'Withdrawal',    icon: '⬆️', green: false },
};

const BROADCAST_COLORS = {
  info:    { bg: 'from-blue-900/60 to-blue-950',    border: 'border-blue-700/50',   icon: '📢', btn: 'bg-blue-600 hover:bg-blue-500' },
  warning: { bg: 'from-amber-900/60 to-amber-950',  border: 'border-amber-700/50',  icon: '⚠️', btn: 'bg-amber-600 hover:bg-amber-500' },
  success: { bg: 'from-emerald-900/60 to-emerald-950', border: 'border-emerald-700/50', icon: '✅', btn: 'bg-emerald-600 hover:bg-emerald-500' },
  promo:   { bg: 'from-purple-900/60 to-purple-950', border: 'border-purple-700/50', icon: '🎉', btn: 'bg-purple-600 hover:bg-purple-500' },
};

export default function DashboardPage() {
  const { user, logout } = useAuth();

  const [balance,    setBalance]    = useState(null);
  const [ledger,     setLedger]     = useState([]);
  const [notifCount, setNotifCount] = useState(0);
  const [support,    setSupport]    = useState(null);
  const [notices,    setNotices]    = useState([]);
  const [broadcasts, setBroadcasts] = useState([]);
  const [currentBC,  setCurrentBC]  = useState(null);
  const [loading,    setLoading]    = useState(true);

  const loadDashboard = useCallback(async () => {
    // Load critical data in parallel — each failure is independent
    const [balRes, ledRes] = await Promise.allSettled([
      walletAPI.getBalance(),
      walletAPI.getLedger({ limit: 6 }),
    ]);

    if (balRes.status === 'fulfilled') setBalance(balRes.value.data.data);
    if (ledRes.status === 'fulfilled') setLedger(ledRes.value.data.data || []);

    // Non-critical data
    walletAPI.getNotifCount().then(r => setNotifCount(r.data.data.count || 0)).catch(() => {});
    walletAPI.getSupport().then(r => setSupport(r.data.data)).catch(() => {});
    broadcastAPI.getNotices().then(r => setNotices(r.data.data || [])).catch(() => {});
    broadcastAPI.getActive().then(r => {
      const list = r.data.data || [];
      if (list.length > 0) {
        setBroadcasts(list);
        setCurrentBC(list[0]);
      }
    }).catch(() => {});

    setLoading(false);
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const dismissBroadcast = async (bc) => {
    broadcastAPI.markRead(bc.id).catch(() => {});
    const remaining = broadcasts.filter(b => b.id !== bc.id);
    setBroadcasts(remaining);
    setCurrentBC(remaining[0] || null);
  };

  return (
    <Layout>
      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* Top bar */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <p className="text-gray-500 text-xs font-medium">Good day 👋</p>
            <p className="text-white font-black text-xl truncate max-w-[200px]">{user?.full_name || 'User'}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/notifications"
              className="relative w-10 h-10 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center hover:border-gray-700 transition-colors">
              <span className="text-lg">🔔</span>
              {notifCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                  <span className="text-white text-xs font-black">{notifCount > 9 ? '9+' : notifCount}</span>
                </span>
              )}
            </Link>
            <button onClick={logout}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors px-3 py-1.5 rounded-xl bg-gray-900 border border-gray-800">
              Sign out
            </button>
          </div>
        </div>

        {/* Balance card */}
        {loading ? (
          <div className="h-44 rounded-3xl bg-gray-900 animate-pulse" />
        ) : (
          <div className="relative rounded-3xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent)]" />
            <div className="absolute -top-10 -right-10 w-44 h-44 bg-white/10 rounded-full" />
            <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-white/10 rounded-full" />
            <div className="relative p-6">
              <p className="text-emerald-100/70 text-sm font-medium mb-1">Total Balance</p>
              <p className="text-4xl font-black text-white tracking-tight">{fmtINR(balance?.balance_inr)}</p>
              <div className="flex gap-4 mt-5 pt-4 border-t border-white/20">
                <div>
                  <p className="text-emerald-100/50 text-xs">Total Deposited</p>
                  <p className="text-white font-bold text-sm mt-0.5">{fmtINR(balance?.total_deposited)}</p>
                </div>
                <div className="w-px bg-white/20" />
                <div>
                  <p className="text-emerald-100/50 text-xs">Total Withdrawn</p>
                  <p className="text-white font-bold text-sm mt-0.5">{fmtINR(balance?.total_withdrawn)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { to: '/deposit?type=inr',  icon: '🏦', label: 'INR',      bg: 'from-emerald-900/60 to-emerald-900/20 border-emerald-800/40' },
            { to: '/deposit?type=usdt', icon: '₮',  label: 'USDT',     bg: 'from-yellow-900/60 to-yellow-900/20 border-yellow-800/40'   },
            { to: '/withdraw',          icon: '⬆️',  label: 'Withdraw', bg: 'from-blue-900/60 to-blue-900/20 border-blue-800/40'         },
            { to: '/invest',            icon: '📊',  label: 'Invest',   bg: 'from-purple-900/60 to-purple-900/20 border-purple-800/40'   },
          ].map(({ to, icon, label, bg }) => (
            <Link key={to} to={to}
              className={`flex flex-col items-center gap-1.5 py-4 rounded-2xl bg-gradient-to-b border transition-all active:scale-95 hover:brightness-110 ${bg}`}>
              <span className="text-xl leading-none">{icon}</span>
              <span className="text-xs font-semibold text-gray-300">{label}</span>
            </Link>
          ))}
        </div>

        {/* Notices from admin */}
        {notices.length > 0 && (
          <div className="space-y-2">
            {notices.map(n => (
              <div key={n.id} className="rounded-2xl bg-indigo-900/20 border border-indigo-800/30 px-4 py-3">
                <p className="text-indigo-300 font-bold text-sm">{n.title}</p>
                <p className="text-indigo-400/70 text-xs mt-0.5 leading-relaxed">{n.body}</p>
              </div>
            ))}
          </div>
        )}

        {/* Recent transactions */}
        <div className="card rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <p className="font-bold text-white text-sm">Recent Transactions</p>
            <Link to="/history" className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold">See all →</Link>
          </div>

          {loading ? (
            <div className="p-4 space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-gray-800 rounded-xl animate-pulse" />)}
            </div>
          ) : ledger.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-3xl mb-2">💸</p>
              <p className="text-gray-500 text-sm">No transactions yet</p>
              <Link to="/deposit" className="mt-3 inline-block text-xs text-emerald-400 font-semibold hover:underline">
                Make your first deposit →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-800/60">
              {ledger.map((entry) => {
                const meta = LEDGER_META[entry.type] || { label: entry.type, icon: '💰', green: true };
                return (
                  <div key={entry.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-800/30 transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-gray-800/80 flex items-center justify-center text-base shrink-0">
                      {meta.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-200">{meta.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(entry.created_at).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <p className={`text-sm font-black shrink-0 ${meta.green ? 'text-emerald-400' : 'text-red-400'}`}>
                      {meta.green ? '+' : '-'}{fmtINR(entry.amount)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Support section */}
        {support && support.support_enabled !== 'false' && (support.support_whatsapp || support.support_telegram) && (
          <div className="card rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800">
              <p className="font-bold text-white text-sm">Customer Support</p>
              <p className="text-xs text-gray-500 mt-0.5">We're here to help 24/7</p>
            </div>
            <div className="p-4 space-y-2">
              {support.support_whatsapp && (
                <a href={`https://wa.me/${support.support_whatsapp.replace(/[^0-9]/g, '')}`}
                  target="_blank" rel="noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl bg-green-900/20 border border-green-800/30 hover:bg-green-900/30 transition-colors">
                  <span className="text-2xl">💬</span>
                  <div>
                    <p className="text-sm font-semibold text-white">WhatsApp Support</p>
                    <p className="text-xs text-gray-400">{support.support_whatsapp}</p>
                  </div>
                  <span className="ml-auto text-green-400 text-xs font-semibold">Chat →</span>
                </a>
              )}
              {support.support_telegram && (
                <a href={`https://t.me/${support.support_telegram.replace('@', '')}`}
                  target="_blank" rel="noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl bg-blue-900/20 border border-blue-800/30 hover:bg-blue-900/30 transition-colors">
                  <span className="text-2xl">✈️</span>
                  <div>
                    <p className="text-sm font-semibold text-white">Telegram Support</p>
                    <p className="text-xs text-gray-400">{support.support_telegram}</p>
                  </div>
                  <span className="ml-auto text-blue-400 text-xs font-semibold">Open →</span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Referral card */}
        {user?.referral_code && (
          <div className="card rounded-2xl px-5 py-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Your Referral Code</p>
              <p className="font-mono text-emerald-400 font-black text-xl tracking-widest">{user.referral_code}</p>
            </div>
            <button onClick={() => { navigator.clipboard.writeText(user.referral_code); }}
              className="text-xs bg-emerald-900/40 border border-emerald-800 text-emerald-400 px-4 py-2.5 rounded-xl hover:bg-emerald-900/60 transition-colors shrink-0 font-semibold">
              Copy
            </button>
          </div>
        )}

        <div className="h-2" />
      </div>

      {/* Broadcast popup */}
      {currentBC && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
          {(() => {
            const style = BROADCAST_COLORS[currentBC.type] || BROADCAST_COLORS.info;
            return (
              <div className={`w-full max-w-sm rounded-3xl border bg-gradient-to-b ${style.bg} ${style.border} overflow-hidden shadow-2xl`}>
                <div className="p-6">
                  <div className="text-4xl mb-4 text-center">{style.icon}</div>
                  <h2 className="text-white font-black text-xl text-center mb-3">{currentBC.title}</h2>
                  <p className="text-gray-300 text-sm leading-relaxed text-center">{currentBC.body}</p>
                </div>
                <div className="px-6 pb-6">
                  <button onClick={() => dismissBroadcast(currentBC)}
                    className={`w-full py-3 rounded-xl text-white font-bold text-sm transition-colors ${style.btn}`}>
                    Got it ✓
                  </button>
                  {broadcasts.length > 1 && (
                    <p className="text-center text-xs text-gray-500 mt-2">{broadcasts.length - 1} more message{broadcasts.length > 2 ? 's' : ''}</p>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </Layout>
  );
}
