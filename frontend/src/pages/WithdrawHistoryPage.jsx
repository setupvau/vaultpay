// src/pages/WithdrawHistoryPage.jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { withdrawalAPI } from '../services/api';
import Layout from '../components/layout/Layout';

const STATUS_BADGE = {
  pending:    'badge-pending',
  approved:   'badge-approved',
  rejected:   'badge-rejected',
  processing: 'badge-reviewing',
};
const STATUS_ICON = { pending:'⏳', approved:'✅', rejected:'❌', processing:'🔄' };
const METHOD_LABEL = { bank: '🏦 Bank Transfer', upi: '📲 UPI' };

export default function WithdrawHistoryPage() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [selected, setSelected]       = useState(null);
  const [page, setPage]               = useState(1);
  const [totalPages, setTotalPages]   = useState(1);

  useEffect(() => {
    setLoading(true);
    withdrawalAPI.getHistory({ page, limit: 10 })
      .then(({ data }) => {
        setWithdrawals(data.data.withdrawals);
        setTotalPages(data.data.pagination.pages || 1);
      })
      .finally(() => setLoading(false));
  }, [page]);

  const fmtINR = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit'
  });

  return (
    <Layout>
      <div className="max-w-lg mx-auto px-4 py-5">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5 pt-1">
          <Link to="/withdraw"
            className="w-9 h-9 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
            ←
          </Link>
          <div>
            <h1 className="text-xl font-black text-white">Withdrawal History</h1>
            <p className="text-gray-500 text-xs">All your withdrawal requests</p>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-900 rounded-2xl animate-pulse" />)}
          </div>
        ) : withdrawals.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">📭</p>
            <p className="text-gray-400 font-semibold mb-1">No withdrawals yet</p>
            <p className="text-gray-600 text-sm mb-6">Your withdrawal requests will appear here</p>
            <Link to="/withdraw" className="btn-primary inline-block text-sm px-6 py-3">
              Make a Withdrawal
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {withdrawals.map(w => (
              <button key={w.id} onClick={() => setSelected(w)}
                className="w-full card rounded-2xl p-4 text-left hover:border-gray-700 transition-all active:scale-[0.99]">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gray-800 flex items-center justify-center text-xl shrink-0">
                    {w.method === 'upi' ? '📲' : '🏦'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold text-white">
                        {w.method === 'upi' ? 'UPI Withdrawal' : 'Bank Withdrawal'}
                      </p>
                      <span className={STATUS_BADGE[w.status]}>{STATUS_ICON[w.status]} {w.status}</span>
                    </div>
                    <p className="text-xs text-gray-500 font-mono truncate">{w.order_number}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{fmtDate(w.created_at)}</p>
                  </div>
                  <p className="text-red-400 font-black text-sm shrink-0 ml-2">
                    -{fmtINR(w.amount)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="btn-secondary text-sm py-2 px-4 disabled:opacity-30">← Prev</button>
            <span className="text-gray-500 text-sm font-medium">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="btn-secondary text-sm py-2 px-4 disabled:opacity-30">Next →</button>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-end justify-center p-4"
          onClick={() => setSelected(null)}>
          <div className="bg-gray-900 rounded-3xl w-full max-w-lg border border-gray-800 overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h2 className="font-black text-white">Withdrawal Details</h2>
              <button onClick={() => setSelected(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-800 text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="p-5 space-y-0">
              {[
                { l: 'Order No.',  v: selected.order_number,                 mono: true },
                { l: 'Amount',     v: fmtINR(selected.amount)                           },
                { l: 'Method',     v: METHOD_LABEL[selected.method]                     },
                selected.upi_id         && { l: 'UPI ID',     v: selected.upi_id         },
                selected.bank_name      && { l: 'Bank',       v: selected.bank_name      },
                selected.account_number && { l: 'Account No.',v: selected.account_number },
                selected.txid           && { l: 'TXID/UTR',  v: selected.txid,  mono:true },
                selected.admin_note     && { l: 'Admin Note', v: selected.admin_note     },
                { l: 'Status',    v: `${STATUS_ICON[selected.status]} ${selected.status}` },
                { l: 'Submitted', v: fmtDate(selected.created_at)                        },
                selected.reviewed_at && { l: 'Reviewed', v: fmtDate(selected.reviewed_at) },
              ].filter(Boolean).map(({ l, v, mono }) => (
                <div key={l} className="flex justify-between gap-3 py-3 border-b border-gray-800/60 last:border-0">
                  <span className="text-gray-500 text-sm shrink-0">{l}</span>
                  <span className={`text-gray-200 text-right text-sm font-semibold break-all ${mono ? 'font-mono text-xs' : ''}`}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
