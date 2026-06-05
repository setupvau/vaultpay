// admin/src/pages/UserDetailPage.jsx
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../context/AdminAuthContext';
import AdminLayout from '../components/layout/AdminLayout';

const fmtINR = (n) =>
  `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

const STATUS_COLOR = {
  pending:    'text-amber-400 bg-amber-900/30',
  reviewing:  'text-blue-400 bg-blue-900/30',
  approved:   'text-emerald-400 bg-emerald-900/30',
  rejected:   'text-red-400 bg-red-900/30',
  active:     'text-blue-400 bg-blue-900/30',
  completed:  'text-emerald-400 bg-emerald-900/30',
};

export default function UserDetailPage() {
  const { user_id } = useParams();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('overview');

  useEffect(() => {
    api.get(`/admin/users/${user_id}`)
      .then(r => setData(r.data.data))
      .finally(() => setLoading(false));
  }, [user_id]);

  if (loading) return (
    <AdminLayout title="User Detail">
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-900 rounded-2xl animate-pulse" />)}
      </div>
    </AdminLayout>
  );

  if (!data) return (
    <AdminLayout title="User Not Found">
      <p className="text-gray-400">User not found.</p>
    </AdminLayout>
  );

  const { user, wallet, stats, deposits, withdrawals, commissions, investments } = data;

  const TABS = [
    { id: 'overview',    label: 'Overview'    },
    { id: 'deposits',    label: `Deposits (${deposits.length})`      },
    { id: 'withdrawals', label: `Withdrawals (${withdrawals.length})` },
    { id: 'investments', label: `Investments (${investments.length})` },
    { id: 'referrals',   label: 'Referrals'   },
  ];

  return (
    <AdminLayout title={`User: ${user.full_name}`}>
      <div className="mb-4">
        <Link to="/users" className="text-sm text-gray-500 hover:text-gray-300">← Back to Users</Link>
      </div>

      {/* User header */}
      <div className="card rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-black text-xl">
            {user.full_name?.charAt(0)}
          </div>
          <div className="flex-1">
            <p className="font-black text-white text-lg">{user.full_name}</p>
            <p className="text-gray-400 text-sm">{user.phone}</p>
            <div className="flex gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${user.status === 'active' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'}`}>
                {user.status}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
                Joined {fmtDate(user.created_at)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'INR Balance',       value: fmtINR(wallet?.balance_inr),           color: 'text-emerald-400' },
          { label: 'Total Deposited',   value: fmtINR(stats.total_deposited_inr),     color: 'text-blue-400'    },
          { label: 'Total Withdrawn',   value: fmtINR(stats.total_withdrawn_inr),     color: 'text-red-400'     },
          { label: 'Total Orders',      value: stats.total_deposit_orders,            color: 'text-white'       },
        ].map(({ label, value, color }) => (
          <div key={label} className="card rounded-2xl p-4">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={`font-black text-lg ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Last activity */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="card rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">Last Deposit</p>
          {stats.last_deposit ? (
            <>
              <p className="font-bold text-white text-sm">{fmtINR(stats.last_deposit.actual_amount)}</p>
              <p className="text-xs text-gray-500">{fmtDate(stats.last_deposit.reviewed_at)}</p>
            </>
          ) : <p className="text-gray-600 text-sm">None</p>}
        </div>
        <div className="card rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">Last Withdrawal</p>
          {stats.last_withdrawal ? (
            <>
              <p className="font-bold text-white text-sm">{fmtINR(stats.last_withdrawal.amount)}</p>
              <p className="text-xs text-gray-500">{fmtDate(stats.last_withdrawal.reviewed_at)}</p>
            </>
          ) : <p className="text-gray-600 text-sm">None</p>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${tab === t.id ? 'bg-indigo-600 text-white' : 'bg-gray-900 border border-gray-700 text-gray-400 hover:bg-gray-800'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === 'overview' && (
        <div className="card rounded-2xl p-5 space-y-3 text-sm">
          <Row label="Phone"          value={user.phone} />
          <Row label="Full Name"      value={user.full_name} />
          <Row label="Status"         value={user.status} />
          <Row label="Role"           value={user.role} />
          <Row label="Referral Code"  value={user.referral_code} />
          <Row label="Referred By"    value={user.referred_by_name ? `${user.referred_by_name} (${user.referred_by_phone})` : 'None'} />
          <Row label="Last Login"     value={fmtDate(user.last_login_at)} />
          <Row label="Joined"         value={fmtDate(user.created_at)} />
        </div>
      )}

      {/* Deposits tab */}
      {tab === 'deposits' && (
        <div className="card rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                <th className="text-left px-4 py-3">Order</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-right px-4 py-3">Amount</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {deposits.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-500">No deposits</td></tr>
              ) : deposits.map(d => (
                <tr key={d.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{d.order_number}</td>
                  <td className="px-4 py-3 text-gray-300">{d.type}</td>
                  <td className="px-4 py-3 text-right font-semibold text-white">
                    {fmtINR(d.actual_amount || d.requested_amount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[d.status] || 'text-gray-400 bg-gray-800'}`}>
                      {d.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(d.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Withdrawals tab */}
      {tab === 'withdrawals' && (
        <div className="card rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                <th className="text-left px-4 py-3">Order</th>
                <th className="text-left px-4 py-3">Method</th>
                <th className="text-right px-4 py-3">Amount</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-500">No withdrawals</td></tr>
              ) : withdrawals.map(w => (
                <tr key={w.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{w.order_number}</td>
                  <td className="px-4 py-3 text-gray-300 capitalize">{w.method}</td>
                  <td className="px-4 py-3 text-right font-semibold text-red-400">{fmtINR(w.amount)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[w.status] || 'text-gray-400 bg-gray-800'}`}>
                      {w.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(w.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Investments tab */}
      {tab === 'investments' && (
        <div className="card rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                <th className="text-left px-4 py-3">Plan</th>
                <th className="text-right px-4 py-3">Amount</th>
                <th className="text-right px-4 py-3">Payout</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Unlocks</th>
              </tr>
            </thead>
            <tbody>
              {investments.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-500">No investments</td></tr>
              ) : investments.map(i => (
                <tr key={i.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="px-4 py-3 text-white font-medium">{i.plan_name}</td>
                  <td className="px-4 py-3 text-right text-white">{fmtINR(i.amount)}</td>
                  <td className="px-4 py-3 text-right text-emerald-400 font-semibold">{fmtINR(i.total_payout)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[i.status] || 'text-gray-400 bg-gray-800'}`}>
                      {i.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(i.locked_until)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Referrals tab */}
      {tab === 'referrals' && (
        <div className="space-y-4">
          {commissions.length === 0 ? (
            <div className="card rounded-2xl p-8 text-center text-gray-500">No referral commissions earned yet</div>
          ) : commissions.map(c => (
            <div key={c.level} className="card rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-black text-white">Level {c.level === 1 ? 'A' : 'B'}</p>
                  <p className="text-xs text-gray-500">{c.count} commissions earned</p>
                </div>
                <p className="text-xl font-black text-emerald-400">{fmtINR(c.total_earned)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-2 py-1.5 border-b border-gray-800/60 last:border-0">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-200 font-medium text-right">{value || '—'}</span>
    </div>
  );
}
