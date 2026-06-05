// admin/src/pages/DashboardPage.jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../context/AdminAuthContext';
import AdminLayout from '../components/layout/AdminLayout';

export default function DashboardPage() {
  const [stats,          setStats]          = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [pendingW,       setPendingW]       = useState(0);
  const [pendingAssign,  setPendingAssign]  = useState(0);

  useEffect(() => {
    Promise.allSettled([
      api.get('/admin/dashboard'),
      api.get('/admin/withdrawals', { params: { status: 'pending', limit: 1 } }),
      api.get('/admin/deposits/pending-assignments'),
    ]).then(([s, w, a]) => {
      if (s.status === 'fulfilled') setStats(s.value.data.data);
      if (w.status === 'fulfilled') setPendingW(w.value.data.data.pagination?.total || 0);
      if (a.status === 'fulfilled') setPendingAssign(a.value.data.data.pending_orders?.length || 0);
    }).finally(() => setLoading(false));
  }, []);

  const cards = stats ? [
    { label: 'Total Users',          value: stats.users.total.toLocaleString(),  sub: `+${stats.users.new_this_week} this week`, icon: '👥', color: 'bg-blue-900/20 border-blue-800/30' },
    { label: 'Needs Assignment',      value: pendingAssign,                        sub: 'INR orders waiting',                      icon: '🔄', color: pendingAssign  > 0 ? 'bg-red-900/20 border-red-800/30'    : 'bg-gray-900 border-gray-800', urgent: pendingAssign  > 0 },
    { label: 'Pending Deposits',      value: stats.pending_reviews,                sub: 'Proof submitted',                         icon: '⬇️',  color: stats.pending_reviews > 0 ? 'bg-amber-900/20 border-amber-800/30' : 'bg-gray-900 border-gray-800', urgent: stats.pending_reviews > 0 },
    { label: 'Pending Withdrawals',   value: pendingW,                             sub: 'Awaiting approval',                       icon: '⬆️',  color: pendingW > 0 ? 'bg-purple-900/20 border-purple-800/30' : 'bg-gray-900 border-gray-800', urgent: pendingW > 0 },
  ] : [];

  return (
    <AdminLayout title="Dashboard">

      {/* Stats cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {loading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-900 rounded-2xl animate-pulse border border-gray-800" />
          ))
        ) : cards.map(({ label, value, sub, icon, color, urgent }) => (
          <div key={label} className={`rounded-2xl border p-5 transition-all ${color}`}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl">{icon}</span>
              {urgent && <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />}
            </div>
            <p className="text-2xl font-black text-white">{value}</p>
            <p className="text-xs text-gray-400 mt-1 font-medium">{label}</p>
            <p className="text-xs text-gray-600 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <QuickCard title="Assign Bank" desc={pendingAssign > 0 ? `${pendingAssign} waiting` : 'All done'} to="/assign"      icon="🔄" urgent={pendingAssign > 0} />
        <QuickCard title="Deposits"    desc={stats ? `${stats.pending_reviews} pending` : '...'} to="/deposits?status=reviewing" icon="⬇️"  urgent={stats?.pending_reviews > 0} />
        <QuickCard title="Withdrawals" desc={pendingW > 0 ? `${pendingW} pending` : 'All clear'} to="/withdrawals?status=pending" icon="⬆️"  urgent={pendingW > 0} />
        <QuickCard title="Broadcasts"  desc="Send messages to users" to="/broadcasts" icon="📢" />
      </div>

      <div className="mt-6 rounded-2xl bg-gray-900 border border-gray-800 p-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">Platform Configuration</p>
          <p className="text-white font-bold mt-0.5">Rates, addresses, bank accounts, investment plans</p>
        </div>
        <Link to="/settings" className="btn-primary text-sm px-4 py-2">Open Settings →</Link>
      </div>
    </AdminLayout>
  );
}

function QuickCard({ title, desc, to, icon, urgent }) {
  return (
    <Link to={to} className={`block rounded-2xl border p-5 transition-all hover:border-indigo-700 hover:bg-indigo-900/10 ${urgent ? 'border-amber-700 bg-amber-900/10' : 'border-gray-800 bg-gray-900'}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        {urgent && <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-bold">Action</span>}
      </div>
      <p className="font-bold text-white text-sm">{title}</p>
      <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
    </Link>
  );
}
