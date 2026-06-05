// src/pages/HistoryPage.jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { depositAPI } from '../services/api';
import Layout from '../components/layout/Layout';

const STATUS_BADGE = { pending:'badge-pending', reviewing:'badge-reviewing', approved:'badge-approved', rejected:'badge-rejected', cancelled:'badge-rejected' };

export default function HistoryPage() {
  const [orders, setOrders]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('');
  const [page, setPage]         = useState(1);
  const [totalPages, setTotal]  = useState(1);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    setLoading(true);
    depositAPI.getHistory({ page, limit:10, status: filter||undefined })
      .then(({ data }) => {
        setOrders(data.data.orders);
        setTotal(data.data.pagination.pages||1);
      })
      .finally(() => setLoading(false));
  }, [page, filter]);

  const fmt = (n,t) => t==='USDT' ? `₮${parseFloat(n).toFixed(4)}` : `₹${parseFloat(n).toLocaleString('en-IN',{minimumFractionDigits:2})}`;
  const fmtDate = d => new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'2-digit',hour:'2-digit',minute:'2-digit'});

  return (
    <Layout>
      <div className="max-w-lg mx-auto px-4 py-5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5 pt-1">
          <Link to="/dashboard" className="w-9 h-9 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-400 hover:text-white transition-colors">←</Link>
          <div>
            <h1 className="text-xl font-black text-white">Deposit History</h1>
            <p className="text-gray-500 text-xs">All your deposit orders</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-hide">
          {['','pending','reviewing','approved','rejected'].map(s => (
            <button key={s} onClick={() => { setFilter(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${filter===s ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-gray-900 border-gray-800 text-gray-500 hover:text-gray-300'}`}>
              {s==='' ? 'All' : s.charAt(0).toUpperCase()+s.slice(1)}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">{[...Array(4)].map((_,i) => <div key={i} className="h-20 bg-gray-900 rounded-2xl animate-pulse" />)}</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">📭</p>
            <p className="text-gray-400 font-medium">No deposits found</p>
            <Link to="/deposit" className="btn-primary inline-block mt-5 text-sm px-5 py-2.5">Make a Deposit</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(o => (
              <button key={o.id} onClick={() => setSelected(o)}
                className="w-full card rounded-2xl p-4 text-left hover:border-gray-700 transition-all active:scale-[0.99]">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ${o.type==='USDT' ? 'bg-yellow-900/40' : 'bg-emerald-900/40'}`}>
                    {o.type==='USDT' ? '₮' : '🏦'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold text-white">{o.type} Deposit</p>
                      <span className={STATUS_BADGE[o.status]}>{o.status}</span>
                    </div>
                    <p className="text-xs text-gray-500 truncate font-mono">{o.order_number}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{fmtDate(o.created_at)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-black text-white">{fmt(o.requested_amount, o.type)}</p>
                    {o.actual_amount && o.actual_amount !== o.requested_amount && (
                      <p className="text-xs text-emerald-400">✓ {fmt(o.actual_amount, o.type)}</p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} className="btn-secondary text-sm py-2 px-4 disabled:opacity-30">← Prev</button>
            <span className="text-gray-500 text-sm font-medium">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages} className="btn-secondary text-sm py-2 px-4 disabled:opacity-30">Next →</button>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-end justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-gray-900 rounded-3xl w-full max-w-lg border border-gray-800 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h2 className="font-bold text-white">Order Details</h2>
              <button onClick={() => setSelected(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-800 text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="p-5 space-y-2.5 text-sm">
              {[
                { l:'Order No.',  v:selected.order_number, mono:true },
                { l:'Type',       v:`${selected.type} Deposit` },
                { l:'Requested',  v:fmt(selected.requested_amount, selected.type) },
                selected.actual_amount && { l:'Confirmed',  v:fmt(selected.actual_amount, selected.type) },
                selected.chain_type && { l:'Network', v:selected.chain_type },
                selected.txid && { l:'TXID', v:selected.txid, mono:true },
                selected.utr_number && { l:'UTR', v:selected.utr_number },
                selected.admin_note && { l:'Admin Note', v:selected.admin_note },
                { l:'Status',   v:selected.status },
                { l:'Date',     v:fmtDate(selected.created_at) },
              ].filter(Boolean).map(({ l, v, mono }) => (
                <div key={l} className="flex justify-between gap-2 py-1.5 border-b border-gray-800/60 last:border-0">
                  <span className="text-gray-500 shrink-0">{l}</span>
                  <span className={`text-gray-200 text-right break-all ${mono ? 'font-mono text-xs' : 'font-medium'}`}>{v}</span>
                </div>
              ))}
            </div>
            {selected.screenshot_url && (
              <div className="px-5 pb-5">
                <p className="text-xs text-gray-500 mb-2">Screenshot</p>
                <a href={selected.screenshot_url} target="_blank" rel="noreferrer">
                  <img src={selected.screenshot_url} alt="Proof" className="w-full rounded-2xl max-h-52 object-contain bg-gray-800 cursor-zoom-in" />
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
