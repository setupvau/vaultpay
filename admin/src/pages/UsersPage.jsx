// admin/src/pages/UsersPage.jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../context/AdminAuthContext';
import AdminLayout from '../components/layout/AdminLayout';

export default function UsersPage() {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [adjModal, setAdjModal] = useState(null);
  const [page,    setPage]    = useState(1);

  const load = () => {
    setLoading(true);
    api.get('/admin/users', { params: { search: search || undefined, page, limit: 20 } })
      .then(r => setUsers(r.data.data.users))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search, page]);

  const freezeUser = async (user, action) => {
    if (!confirm(`${action === 'freeze' ? 'Freeze' : 'Unfreeze'} ${user.full_name}?`)) return;
    try {
      await api.patch(`/admin/users/${user.id}/freeze`, { action, reason: 'Admin action' });
      toast.success(`User ${action}d`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const fmtINR = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  return (
    <AdminLayout title="Users">
      <div className="flex flex-wrap gap-3 mb-6">
        <input type="text" placeholder="Search by phone or name..."
          className="input w-72"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }} />
        <p className="text-gray-500 text-sm self-center">{users.length} users shown</p>
      </div>

      <div className="card rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
              <th className="text-left px-5 py-3">User</th>
              <th className="text-right px-4 py-3">Balance</th>
              <th className="text-right px-4 py-3">Deposited</th>
              <th className="text-center px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Joined</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-gray-800/50">
                  <td colSpan={6} className="px-5 py-4"><div className="h-4 bg-gray-800 rounded animate-pulse w-3/4" /></td>
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-500">No users found</td></tr>
            ) : users.map(u => (
              <tr key={u.id} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                <td className="px-5 py-3">
                  <Link to={`/users/${u.id}`} className="hover:text-indigo-400 transition-colors">
                    <p className="font-semibold text-white">{u.full_name}</p>
                    <p className="text-gray-500 text-xs">{u.phone}</p>
                  </Link>
                </td>
                <td className="px-4 py-3 text-right text-emerald-400 font-semibold">
                  {fmtINR(u.balance_inr)}
                </td>
                <td className="px-4 py-3 text-right text-gray-300">
                  {fmtINR(u.total_deposited)}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.status === 'active' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'}`}>
                    {u.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {new Date(u.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <Link to={`/users/${u.id}`} className="text-xs text-indigo-400 hover:text-indigo-300">View</Link>
                  <button onClick={() => setAdjModal(u)} className="text-xs text-yellow-400 hover:text-yellow-300">Adjust</button>
                  {u.status === 'active'
                    ? <button onClick={() => freezeUser(u, 'freeze')} className="text-xs text-red-400 hover:text-red-300">Freeze</button>
                    : <button onClick={() => freezeUser(u, 'unfreeze')} className="text-xs text-emerald-400 hover:text-emerald-300">Unfreeze</button>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex gap-3 justify-center mt-5">
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
          className="px-4 py-2 bg-gray-900 border border-gray-700 rounded-xl text-sm text-gray-400 hover:bg-gray-800 disabled:opacity-30">← Prev</button>
        <span className="px-4 py-2 text-sm text-gray-500">Page {page}</span>
        <button onClick={() => setPage(p => p + 1)} disabled={users.length < 20}
          className="px-4 py-2 bg-gray-900 border border-gray-700 rounded-xl text-sm text-gray-400 hover:bg-gray-800 disabled:opacity-30">Next →</button>
      </div>

      {adjModal && (
        <AdjustWalletModal user={adjModal} onClose={() => setAdjModal(null)} onDone={() => { setAdjModal(null); load(); }} />
      )}
    </AdminLayout>
  );
}

function AdjustWalletModal({ user, onClose, onDone }) {
  const [form, setForm] = useState({ action: 'credit', amount: '', currency: 'INR', reason: '' });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.amount || !form.reason) return toast.error('Fill all fields');
    setLoading(true);
    try {
      await api.post(`/admin/users/${user.id}/wallet/adjust`, { ...form, amount: parseFloat(form.amount) });
      toast.success(`Wallet ${form.action}ed successfully`);
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-900 rounded-2xl w-full max-w-md border border-gray-700" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="font-bold text-white">Adjust Wallet — {user.full_name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Action</label>
              <select className="input" value={form.action} onChange={e => setForm({ ...form, action: e.target.value })}>
                <option value="credit">Credit (Add)</option>
                <option value="debit">Debit (Remove)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Currency</label>
              <select className="input" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
                <option value="INR">INR</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Amount</label>
            <input type="number" step="0.01" required className="input"
              value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Reason (required for audit)</label>
            <input type="text" required className="input" placeholder="e.g. Bonus, correction, refund..."
              value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
          </div>
          <button type="submit" disabled={loading}
            className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-colors text-white ${form.action === 'credit' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-700 hover:bg-red-600'}`}>
            {loading ? 'Processing...' : `${form.action === 'credit' ? '+ Credit' : '- Debit'} Wallet`}
          </button>
        </form>
      </div>
    </div>
  );
}
