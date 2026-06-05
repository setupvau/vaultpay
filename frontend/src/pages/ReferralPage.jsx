// src/pages/ReferralPage.jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { walletAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/layout/Layout';

const fmtINR = (n) =>
  `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';

export default function ReferralPage() {
  const { user }  = useAuth();
  const [stats,   setStats]   = useState(null);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied,  setCopied]  = useState(false);
  const [tab,     setTab]     = useState('stats');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    Promise.allSettled([
      walletAPI.getReferralStats(),
      walletAPI.getMyInvites(),
    ]).then(([s, i]) => {
      if (s.status === 'fulfilled') setStats(s.value.data.data);
      if (i.status === 'fulfilled') setInvites(i.value.data.data);
    }).finally(() => setLoading(false));
  }, []);

  const referralLink = `${window.location.origin}/register?ref=${user?.referral_code}`;

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
            <h1 className="text-xl font-black text-white">Referral Program</h1>
            <p className="text-gray-500 text-xs">Earn commissions on every deposit</p>
          </div>
        </div>

        {/* How it works */}
        <div className="card rounded-2xl p-5 mb-4 bg-gradient-to-br from-emerald-900/30 to-teal-900/20 border-emerald-800/30">
          <p className="font-black text-white mb-3">How it works</p>
          <div className="space-y-3">
            {[
              { level: 'A', color: 'bg-emerald-600', pct: '0.8%', desc: 'of every deposit made by people you directly invite' },
              { level: 'B', color: 'bg-teal-600',    pct: '0.4%', desc: 'of every deposit made by people your invitees invite' },
            ].map(({ level, color, pct, desc }) => (
              <div key={level} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center text-white font-black text-sm shrink-0`}>{level}</div>
                <div>
                  <p className="text-sm font-bold text-white">Level {level} — Direct Referrals</p>
                  <p className="text-xs text-gray-400">Earn <span className={`font-bold ${level === 'A' ? 'text-emerald-400' : 'text-teal-400'}`}>{pct}</span> {desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Referral code + link */}
        <div className="card rounded-2xl p-5 mb-4">
          <p className="text-sm font-bold text-gray-400 mb-3">Your Referral Code</p>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 bg-gray-800 rounded-xl px-4 py-3">
              <p className="font-mono font-black text-emerald-400 text-xl tracking-widest">{user?.referral_code}</p>
            </div>
            <button onClick={copyLink}
              className={`px-4 py-3 rounded-xl text-sm font-bold transition-all shrink-0 ${copied ? 'bg-emerald-600 text-white' : 'bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700'}`}>
              {copied ? '✓ Copied!' : 'Copy Link'}
            </button>
          </div>
          <div className="bg-gray-800/50 rounded-xl px-3 py-2">
            <p className="text-xs text-gray-500 break-all">{referralLink}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {[
            { id: 'stats',   label: '📊 My Stats'                          },
            { id: 'invites', label: `👥 Invited (${invites.length})`       },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${tab === t.id ? 'bg-emerald-600 text-white' : 'bg-gray-900 border border-gray-800 text-gray-400 hover:bg-gray-800'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Stats tab */}
        {tab === 'stats' && (
          <div className="space-y-3">
            {loading ? (
              [...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-900 rounded-2xl animate-pulse" />)
            ) : (
              <>
                {/* Total invites */}
                <div className="card rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-900/40 flex items-center justify-center text-xl">👥</div>
                    <div>
                      <p className="text-sm font-bold text-white">Total Invitations</p>
                      <p className="text-xs text-gray-500">People you've directly invited</p>
                    </div>
                  </div>
                  <p className="text-2xl font-black text-white">{stats?.total_invites || 0}</p>
                </div>

                {/* Level A */}
                <div className="card rounded-2xl p-4 border-emerald-800/30 bg-emerald-900/10">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-white font-black text-xs">A</div>
                    <p className="font-bold text-white text-sm">Level A — 0.8% Commission</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-800/50 rounded-xl p-3">
                      <p className="text-xs text-gray-500 mb-1">Total Recharge</p>
                      <p className="font-black text-white text-sm">{fmtINR(stats?.level_a?.total_recharge)}</p>
                    </div>
                    <div className="bg-gray-800/50 rounded-xl p-3">
                      <p className="text-xs text-gray-500 mb-1">Commission Earned</p>
                      <p className="font-black text-emerald-400 text-sm">{fmtINR(stats?.level_a?.commission_earned)}</p>
                    </div>
                  </div>
                </div>

                {/* Level B */}
                <div className="card rounded-2xl p-4 border-teal-800/30 bg-teal-900/10">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-full bg-teal-600 flex items-center justify-center text-white font-black text-xs">B</div>
                    <p className="font-bold text-white text-sm">Level B — 0.4% Commission</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-800/50 rounded-xl p-3">
                      <p className="text-xs text-gray-500 mb-1">Total Recharge</p>
                      <p className="font-black text-white text-sm">{fmtINR(stats?.level_b?.total_recharge)}</p>
                    </div>
                    <div className="bg-gray-800/50 rounded-xl p-3">
                      <p className="text-xs text-gray-500 mb-1">Commission Earned</p>
                      <p className="font-black text-teal-400 text-sm">{fmtINR(stats?.level_b?.commission_earned)}</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Invites tab */}
        {tab === 'invites' && (
          <div>
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-900 rounded-2xl animate-pulse" />)}
              </div>
            ) : invites.length === 0 ? (
              <div className="text-center py-12 card rounded-2xl">
                <p className="text-4xl mb-3">👥</p>
                <p className="text-gray-400 font-semibold">No invitations yet</p>
                <p className="text-gray-600 text-sm mt-1">Share your referral link to start earning</p>
                <button onClick={copyLink}
                  className="mt-4 btn-primary text-sm px-5 py-2.5">
                  Copy Referral Link
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {invites.map(inv => (
                  <button key={inv.id} onClick={() => setSelected(inv)}
                    className="w-full card rounded-2xl p-4 text-left hover:border-gray-700 transition-all active:scale-[0.99]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-white font-black text-base shrink-0">
                        {inv.full_name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white text-sm">{inv.full_name}</p>
                        <p className="text-xs text-gray-500">{inv.phone}</p>
                        <p className="text-xs text-gray-600 mt-0.5">Joined {fmtDate(inv.created_at)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-black text-emerald-400 text-sm">{fmtINR(inv.total_deposited)}</p>
                        <p className="text-xs text-gray-500">{inv.deposit_count} deposits</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Invite detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-end justify-center p-4"
          onClick={() => setSelected(null)}>
          <div className="bg-gray-900 rounded-3xl w-full max-w-lg border border-gray-800 overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h2 className="font-black text-white">Invite Details</h2>
              <button onClick={() => setSelected(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-800 text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-white font-black text-2xl">
                  {selected.full_name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <p className="font-black text-white text-lg">{selected.full_name}</p>
                  <p className="text-gray-400 text-sm">{selected.phone}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Total Deposited', value: fmtINR(selected.total_deposited), color: 'text-emerald-400' },
                  { label: 'Total Deposits',  value: `${selected.deposit_count} orders`, color: 'text-white'       },
                  { label: 'Current Balance', value: fmtINR(selected.balance_inr),      color: 'text-blue-400'    },
                  { label: 'Last Deposit',    value: fmtDate(selected.last_deposit_at), color: 'text-gray-300'    },
                  { label: 'Joined',          value: fmtDate(selected.created_at),      color: 'text-gray-300'    },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-gray-800/50 rounded-xl p-3">
                    <p className="text-xs text-gray-500 mb-1">{label}</p>
                    <p className={`font-bold text-sm ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
