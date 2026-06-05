// admin/src/pages/InvestmentsPage.jsx
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { api } from '../context/AdminAuthContext';
import AdminLayout from '../components/layout/AdminLayout';

const fmtINR = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

const STATUS_COLOR = {
  active:    'text-blue-400 bg-blue-900/30',
  completed: 'text-emerald-400 bg-emerald-900/30',
  cancelled: 'text-red-400 bg-red-900/30',
};

export default function InvestmentsPage() {
  const [investments, setInvestments] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [processing,  setProcessing]  = useState(false);
  const [filter,      setFilter]      = useState('');

  const load = () => {
    setLoading(true);
    api.get('/admin/investments')
      .then(r => setInvestments(r.data.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const processMatured = async () => {
    setProcessing(true);
    try {
      const { data } = await api.post('/admin/investments/process-matured');
      toast.success(data.message);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setProcessing(false); }
  };

  const now = new Date();
  const maturedCount = investments.filter(i => i.status === 'active' && new Date(i.locked_until) <= now).length;

  const filtered = filter
    ? investments.filter(i => i.status === filter)
    : investments;

  const totalActive    = investments.filter(i => i.status === 'active').reduce((s, i) => s + parseFloat(i.amount), 0);
  const totalCompleted = investments.filter(i => i.status === 'completed').reduce((s, i) => s + parseFloat(i.total_payout), 0);

  return (
    <AdminLayout title="Investments">

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">Active Investments</p>
          <p className="text-xl font-black text-blue-400">{fmtINR(totalActive)}</p>
          <p className="text-xs text-gray-600">{investments.filter(i => i.status === 'active').length} plans</p>
        </div>
        <div className="card rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">Matured (Unpaid)</p>
          <p className={`text-xl font-black ${maturedCount > 0 ? 'text-amber-400' : 'text-gray-400'}`}>{maturedCount}</p>
          <p className="text-xs text-gray-600">Ready to process</p>
        </div>
        <div className="card rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">Total Paid Out</p>
          <p className="text-xl font-black text-emerald-400">{fmtINR(totalCompleted)}</p>
          <p className="text-xs text-gray-600">{investments.filter(i => i.status === 'completed').length} completed</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex gap-2">
          {['', 'active', 'completed', 'cancelled'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-2 rounded-xl text-sm transition-colors ${filter === s ? 'bg-indigo-600 text-white' : 'bg-gray-900 border border-gray-700 text-gray-400 hover:bg-gray-800'}`}>
              {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <button
          onClick={processMatured}
          disabled={processing || maturedCount === 0}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            maturedCount > 0
              ? 'bg-amber-600 hover:bg-amber-500 text-white'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed'
          }`}>
          {processing ? 'Processing...' : `💰 Process ${maturedCount} Matured`}
        </button>
      </div>

      {/* Table */}
      <div className="card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                <th className="text-left px-5 py-3">User</th>
                <th className="text-left px-4 py-3">Plan</th>
                <th className="text-right px-4 py-3">Amount</th>
                <th className="text-right px-4 py-3">Payout</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Unlocks</th>
                <th className="text-left px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-800/50">
                    <td colSpan={7} className="px-5 py-4"><div className="h-4 bg-gray-800 rounded animate-pulse w-3/4" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-500">No investments found</td></tr>
              ) : filtered.map(inv => {
                const matured = inv.status === 'active' && new Date(inv.locked_until) <= now;
                return (
                  <tr key={inv.id} className={`border-b border-gray-800/50 hover:bg-gray-800/20 ${matured ? 'bg-amber-900/5' : ''}`}>
                    <td className="px-5 py-3">
                      <p className="text-white text-sm font-medium">{inv.full_name}</p>
                      <p className="text-gray-500 text-xs">{inv.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{inv.plan_name}</td>
                    <td className="px-4 py-3 text-right font-semibold text-white">{fmtINR(inv.amount)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-400">{fmtINR(inv.total_payout)}</td>
                    <td className="px-4 py-3 text-center">
                      {matured ? (
                        <span className="text-xs px-2 py-1 rounded-full bg-amber-900/40 text-amber-400 border border-amber-800 font-bold">⏰ Matured</span>
                      ) : (
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[inv.status] || 'text-gray-400 bg-gray-800'}`}>
                          {inv.status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(inv.locked_until)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(inv.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
