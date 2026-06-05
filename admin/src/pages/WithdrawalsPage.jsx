// admin/src/pages/WithdrawalsPage.jsx
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { api } from '../context/AdminAuthContext';
import AdminLayout from '../components/layout/AdminLayout';

const STATUS_COLOR = {
  pending:    'text-amber-400 bg-amber-900/30',
  approved:   'text-emerald-400 bg-emerald-900/30',
  rejected:   'text-red-400 bg-red-900/30',
  processing: 'text-blue-400 bg-blue-900/30',
};

const METHOD_LABEL = { bank:'🏦 Bank', upi:'📲 UPI', usdt_wallet:'₮ USDT' };

export default function WithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatus]     = useState('');
  const [reviewModal, setReview]      = useState(null);
  const [page, setPage]               = useState(1);

  const load = () => {
    setLoading(true);
    api.get('/admin/withdrawals', { params: { status: statusFilter||undefined, search: search||undefined, page, limit:20 } })
      .then(({ data }) => setWithdrawals(data.data.withdrawals))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusFilter, search, page]);

  const fmt = (n, cur) => cur==='USDT' ? `₮${parseFloat(n).toFixed(4)}` : `₹${parseFloat(n).toLocaleString('en-IN',{minimumFractionDigits:2})}`;

  return (
    <AdminLayout title="Withdrawals">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input type="text" placeholder="Search phone, name, order..."
          className="input w-64"
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        <div className="flex gap-2">
          {['','pending','approved','rejected'].map(s => (
            <button key={s} onClick={() => { setStatus(s); setPage(1); }}
              className={`px-3 py-2 rounded-xl text-sm transition-colors ${statusFilter===s ? 'bg-indigo-600 text-white' : 'bg-gray-900 border border-gray-700 text-gray-400 hover:bg-gray-800'}`}>
              {s==='' ? 'All' : s.charAt(0).toUpperCase()+s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                <th className="text-left px-5 py-3">Order</th>
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Method</th>
                <th className="text-right px-4 py-3">Amount</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-right px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_,i) => (
                  <tr key={i} className="border-b border-gray-800/50">
                    <td colSpan={7} className="px-5 py-4"><div className="h-4 bg-gray-800 rounded animate-pulse w-3/4" /></td>
                  </tr>
                ))
              ) : withdrawals.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-500">No withdrawals found</td></tr>
              ) : withdrawals.map(w => (
                <tr key={w.id} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-gray-300">{w.order_number}</td>
                  <td className="px-4 py-3">
                    <p className="text-white text-sm">{w.full_name}</p>
                    <p className="text-gray-500 text-xs">{w.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">{METHOD_LABEL[w.method]}</td>
                  <td className="px-4 py-3 text-right font-semibold text-red-400">{fmt(w.amount, w.currency)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLOR[w.status]}`}>{w.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(w.created_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {w.status === 'pending' && (
                      <button onClick={() => setReview(w)} className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors">
                        Review
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {reviewModal && (
        <ReviewModal w={reviewModal} onClose={() => setReview(null)} onDone={() => { setReview(null); load(); }} />
      )}
    </AdminLayout>
  );
}

function ReviewModal({ w, onClose, onDone }) {
  const [txid, setTxid]   = useState('');
  const [note, setNote]   = useState('');
  const [loading, setLoading] = useState(false);

  const fmt = (n, cur) => cur==='USDT' ? `₮${parseFloat(n).toFixed(4)}` : `₹${parseFloat(n).toLocaleString('en-IN')}`;

  const submit = async (action) => {
    setLoading(true);
    try {
      await api.patch(`/admin/withdrawals/${w.id}/review`, { action, txid: txid||undefined, note: note||undefined });
      toast.success(action==='approve' ? '✅ Withdrawal approved' : 'Withdrawal rejected — amount refunded');
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-900 rounded-2xl w-full max-w-md border border-gray-700 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="font-bold text-white">Review Withdrawal</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white w-7 h-7 flex items-center justify-center rounded-full bg-gray-800">✕</button>
        </div>
        <div className="p-5">
          {/* Details */}
          <div className="space-y-2 text-sm mb-5">
            <R label="User"   value={`${w.full_name} (${w.phone})`} />
            <R label="Amount" value={fmt(w.amount, w.currency)} />
            <R label="Method" value={{ bank:'Bank Transfer', upi:'UPI', usdt_wallet:'USDT Wallet' }[w.method]} />
            {w.upi_id         && <R label="UPI ID"         value={w.upi_id} />}
            {w.bank_name      && <R label="Bank"           value={w.bank_name} />}
            {w.account_number && <R label="Account No."    value={w.account_number} />}
            {w.ifsc_code      && <R label="IFSC"           value={w.ifsc_code} />}
            {w.wallet_address && <R label="Wallet"         value={w.wallet_address} mono />}
            {w.chain_type     && <R label="Network"        value={w.chain_type} />}
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Transaction ID / UTR (optional)</label>
              <input type="text" className="input" placeholder="Add TXID or UTR after sending..."
                value={txid} onChange={e => setTxid(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Note (optional)</label>
              <textarea className="input resize-none" rows={2} placeholder="Add a note..."
                value={note} onChange={e => setNote(e.target.value)} />
            </div>
          </div>

          <div className="flex gap-3 mt-5">
            <button onClick={() => submit('reject')} disabled={loading}
              className="flex-1 bg-red-900/30 hover:bg-red-900/50 border border-red-800 text-red-300 font-medium py-2.5 rounded-xl transition-colors text-sm">
              ✕ Reject & Refund
            </button>
            <button onClick={() => submit('approve')} disabled={loading}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm">
              ✓ Approve & Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function R({ label, value, mono }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className={`text-gray-200 text-right break-all ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  );
}
