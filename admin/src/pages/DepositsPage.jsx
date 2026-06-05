// admin/src/pages/DepositsPage.jsx
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../context/AdminAuthContext';
import AdminLayout from '../components/layout/AdminLayout';

const STATUS_COLOR = {
  pending:   'text-yellow-400 bg-yellow-900/30',
  reviewing: 'text-blue-400 bg-blue-900/30',
  approved:  'text-green-400 bg-green-900/30',
  rejected:  'text-red-400 bg-red-900/30',
};

export default function DepositsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [deposits, setDeposits]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(null);
  const [reviewModal, setReview]  = useState(null);
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState('');

  const statusFilter = searchParams.get('status') || '';

  const loadDeposits = () => {
    setLoading(true);
    api.get('/admin/deposits', { params: { status: statusFilter || undefined, search: search || undefined, page, limit: 20 } })
      .then(({ data }) => setDeposits(data.data.deposits))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadDeposits(); }, [statusFilter, page, search]);

  const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <AdminLayout title="Deposits">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text" placeholder="Search phone, name, order..."
          className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-sm text-white w-64 focus:outline-none focus:border-indigo-500"
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <div className="flex gap-2">
          {['', 'pending', 'reviewing', 'approved', 'rejected'].map((s) => (
            <button key={s} onClick={() => { setSearchParams(s ? { status: s } : {}); setPage(1); }}
              className={`px-3 py-2 rounded-xl text-sm transition-colors ${statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-gray-900 border border-gray-700 text-gray-400 hover:bg-gray-800'}`}>
              {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wide">
                <th className="text-left px-5 py-3">Order</th>
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-right px-4 py-3">Amount</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-right px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-800/50">
                    <td colSpan={7} className="px-5 py-4"><div className="h-4 bg-gray-800 rounded animate-pulse w-3/4" /></td>
                  </tr>
                ))
              ) : deposits.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-500">No deposits found</td></tr>
              ) : deposits.map((d) => (
                <tr key={d.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="px-5 py-3">
                    <p className="font-mono text-xs text-gray-300">{d.order_number}</p>
                    {d.screenshot_url && <span className="text-xs text-blue-400">📎 Has proof</span>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-white text-sm">{d.full_name}</p>
                    <p className="text-gray-500 text-xs">{d.phone}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-lg ${d.type === 'USDT' ? 'bg-yellow-900/40 text-yellow-300' : 'bg-green-900/40 text-green-300'}`}>
                      {d.type} {d.chain_type ? `(${d.chain_type})` : ''}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="font-semibold text-white">{d.type === 'USDT' ? `₮${d.requested_amount}` : `₹${parseFloat(d.requested_amount).toLocaleString('en-IN')}`}</p>
                    {d.actual_amount && d.actual_amount !== d.requested_amount && (
                      <p className="text-xs text-green-400">Actual: {d.type === 'USDT' ? `₮${d.actual_amount}` : `₹${parseFloat(d.actual_amount).toLocaleString('en-IN')}`}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLOR[d.status]}`}>{d.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDate(d.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setSelected(d)} className="text-xs text-indigo-400 hover:text-indigo-300 mr-2">View</button>
                    {['pending', 'reviewing'].includes(d.status) && (
                      <button onClick={() => setReview(d)} className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded-lg transition-colors">
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

      {/* Detail Modal */}
      {selected && (
        <Modal onClose={() => setSelected(null)} title="Deposit Details">
          <div className="space-y-3 text-sm">
            <Row label="Order No." value={selected.order_number} mono />
            <Row label="User"      value={`${selected.full_name} (${selected.phone})`} />
            <Row label="Type"      value={`${selected.type} ${selected.chain_type ? `(${selected.chain_type})` : ''}`} />
            <Row label="Requested" value={`${selected.type === 'USDT' ? '₮' : '₹'}${selected.requested_amount}`} />
            {selected.actual_amount && <Row label="Confirmed" value={`${selected.type === 'USDT' ? '₮' : '₹'}${selected.actual_amount}`} />}
            {selected.txid && <Row label="TXID" value={selected.txid} mono />}
            {selected.utr_number && <Row label="UTR" value={selected.utr_number} />}
            {selected.admin_note && <Row label="Admin Note" value={selected.admin_note} />}
            <Row label="Status" value={selected.status} />
          </div>
          {selected.screenshot_url && (
            <div className="mt-4">
              <p className="text-xs text-gray-500 mb-2">Screenshot</p>
              <a href={selected.screenshot_url} target="_blank" rel="noreferrer">
                <img src={selected.screenshot_url} alt="Proof" className="w-full max-h-64 object-contain rounded-xl bg-gray-800 cursor-zoom-in" />
              </a>
            </div>
          )}
        </Modal>
      )}

      {/* Review Modal */}
      {reviewModal && (
        <ReviewModal
          deposit={reviewModal}
          onClose={() => setReview(null)}
          onDone={() => { setReview(null); loadDeposits(); }}
        />
      )}
    </AdminLayout>
  );
}

// ─── Review Modal ─────────────────────────────────────────────
function ReviewModal({ deposit, onClose, onDone }) {
  const [actualAmount, setActualAmount] = useState(deposit.requested_amount || '');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (action) => {
    if (action === 'approve' && !actualAmount) return toast.error('Enter actual amount');
    setLoading(true);
    try {
      await api.patch(`/admin/deposits/${deposit.id}/review`, {
        action,
        actual_amount: action === 'approve' ? parseFloat(actualAmount) : undefined,
        note,
      });
      toast.success(action === 'approve' ? 'Deposit approved! Wallet credited.' : 'Deposit rejected.');
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal onClose={onClose} title="Review Deposit">
      <div className="space-y-3 text-sm mb-5">
        <Row label="User"      value={`${deposit.full_name} (${deposit.phone})`} />
        <Row label="Type"      value={`${deposit.type} ${deposit.chain_type ? `(${deposit.chain_type})` : ''}`} />
        <Row label="Requested" value={`${deposit.type === 'USDT' ? '₮' : '₹'}${deposit.requested_amount}`} />
        {deposit.txid && <Row label="TXID" value={deposit.txid} mono />}
        {deposit.utr_number && <Row label="UTR" value={deposit.utr_number} />}
      </div>

      {deposit.screenshot_url && (
        <div className="mb-5">
          <a href={deposit.screenshot_url} target="_blank" rel="noreferrer">
            <img src={deposit.screenshot_url} alt="Proof" className="w-full max-h-48 object-contain rounded-xl bg-gray-800" />
          </a>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">
            Actual Amount {deposit.type === 'USDT' ? '(USDT)' : '(INR)'} — edit if different from requested
          </label>
          <input
            type="number" step="0.01"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
            value={actualAmount}
            onChange={(e) => setActualAmount(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Note (optional)</label>
          <textarea
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm resize-none"
            rows={2} placeholder="Reason or comment..."
            value={note} onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-3 mt-5">
        <button onClick={() => submit('reject')} disabled={loading}
          className="flex-1 bg-red-900/40 hover:bg-red-900/60 border border-red-800 text-red-300 font-medium py-2.5 rounded-xl transition-colors text-sm">
          ✕ Reject
        </button>
        <button onClick={() => submit('approve')} disabled={loading}
          className="flex-1 bg-green-600 hover:bg-green-500 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm">
          ✓ Approve & Credit
        </button>
      </div>
    </Modal>
  );
}

function Modal({ onClose, title, children }) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-900 rounded-2xl w-full max-w-lg border border-gray-700 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-800">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className={`text-gray-200 text-right break-all ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  );
}
