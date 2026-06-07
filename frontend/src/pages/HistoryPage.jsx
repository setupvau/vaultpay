// src/pages/HistoryPage.jsx
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import imageCompression from 'browser-image-compression';
import { depositAPI } from '../services/api';
import Layout from '../components/layout/Layout';

const STATUS_BADGE = {
  pending:            'badge-pending',
  pending_assignment: 'badge-pending',
  assigned:           'badge-reviewing',
  reviewing:          'badge-reviewing',
  approved:           'badge-approved',
  rejected:           'badge-rejected',
  cancelled:          'badge-rejected',
};

const STATUS_LABEL = {
  pending:            'Pending',
  pending_assignment: 'Waiting Assignment',
  assigned:           'Bank Assigned — Pay Now',
  reviewing:          'Under Review',
  approved:           'Approved',
  rejected:           'Rejected',
  cancelled:          'Cancelled',
};

const fmt = (n, t) =>
  t === 'USDT'
    ? `₮${parseFloat(n).toFixed(4)}`
    : `₹${parseFloat(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });

export default function HistoryPage() {
  const navigate = useNavigate();
  const [orders,      setOrders]     = useState([]);
  const [loading,     setLoading]    = useState(true);
  const [filter,      setFilter]     = useState('');
  const [page,        setPage]       = useState(1);
  const [totalPages,  setTotal]      = useState(1);
  const [selected,    setSelected]   = useState(null);
  const [resumeOrder, setResumeOrder] = useState(null); // order being resumed

  useEffect(() => {
    setLoading(true);
    depositAPI.getHistory({ page, limit: 10, status: filter || undefined })
      .then(({ data }) => {
        setOrders(data.data.orders);
        setTotal(data.data.pagination.pages || 1);
      })
      .finally(() => setLoading(false));
  }, [page, filter]);

  const handleResume = (order) => {
    // If assigned — show bank details + proof upload
    // If pending_assignment — show waiting screen message
    if (order.status === 'pending_assignment') {
      toast('Your order is still waiting for a bank account to be assigned. Please check back soon.', {
        icon: '⏳', duration: 5000,
      });
      return;
    }
    setResumeOrder(order);
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
            <h1 className="text-xl font-black text-white">Deposit History</h1>
            <p className="text-gray-500 text-xs">All your deposit orders</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-hide">
          {['', 'pending', 'reviewing', 'approved', 'rejected'].map(s => (
            <button key={s} onClick={() => { setFilter(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                filter === s
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-gray-900 border-gray-800 text-gray-500 hover:text-gray-300'
              }`}>
              {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Orders list */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-900 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">📭</p>
            <p className="text-gray-400 font-semibold">No orders found</p>
            <Link to="/deposit" className="btn-primary inline-block mt-5 text-sm px-5 py-2.5">
              Make a Deposit
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(o => {
              const isActionable = ['assigned', 'pending_assignment'].includes(o.status);
              const isAssigned   = o.status === 'assigned';

              return (
                <div key={o.id}
                  className={`card rounded-2xl p-4 border transition-all ${
                    isAssigned ? 'border-amber-700/50 bg-amber-900/10' : 'hover:border-gray-700'
                  }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ${
                      o.type === 'USDT' ? 'bg-yellow-900/40' : 'bg-emerald-900/40'
                    }`}>
                      {o.type === 'USDT' ? '₮' : '🏦'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-sm font-bold text-white">{o.type} Deposit</p>
                        <span className={STATUS_BADGE[o.status] || 'badge-pending'}>
                          {STATUS_LABEL[o.status] || o.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 font-mono truncate">{o.order_number}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{fmtDate(o.created_at)}</p>
                    </div>

                    <div className="text-right shrink-0 ml-2">
                      <p className="font-black text-white text-sm">
                        {fmt(o.requested_amount, o.type)}
                      </p>
                      {o.actual_amount && o.actual_amount !== o.requested_amount && (
                        <p className="text-xs text-emerald-400">
                          ✓ {fmt(o.actual_amount, o.type)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 mt-3">
                    {isAssigned && (
                      <button
                        onClick={() => handleResume(o)}
                        className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs transition-all active:scale-95">
                        ⚡ Complete Payment
                      </button>
                    )}
                    {o.status === 'pending_assignment' && (
                      <button
                        onClick={() => handleResume(o)}
                        className="flex-1 py-2 rounded-xl bg-blue-900/40 border border-blue-800 text-blue-300 font-bold text-xs transition-all">
                        ⏳ Check Status
                      </button>
                    )}
                    <button
                      onClick={() => setSelected(o)}
                      className={`py-2 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 font-semibold text-xs transition-all ${isActionable ? '' : 'flex-1'}`}>
                      View Details
                    </button>
                  </div>
                </div>
              );
            })}
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

      {/* Order detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-end justify-center p-4"
          onClick={() => setSelected(null)}>
          <div className="bg-gray-900 rounded-3xl w-full max-w-lg border border-gray-800 overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h2 className="font-black text-white">Order Details</h2>
              <button onClick={() => setSelected(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-800 text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="p-5 space-y-0">
              {[
                { l: 'Order No.',  v: selected.order_number,                                                              mono: true },
                { l: 'Type',       v: `${selected.type} Deposit`                                                                    },
                { l: 'Requested',  v: fmt(selected.requested_amount, selected.type)                                                  },
                selected.actual_amount && { l: 'Confirmed', v: fmt(selected.actual_amount, selected.type)                            },
                selected.chain_type && { l: 'Network',  v: selected.chain_type                                                       },
                selected.txid && { l: 'TXID',       v: selected.txid,       mono: true                                              },
                selected.utr_number && { l: 'UTR',   v: selected.utr_number                                                         },
                selected.admin_note && { l: 'Note',  v: selected.admin_note                                                         },
                { l: 'Status',     v: STATUS_LABEL[selected.status] || selected.status                                               },
                { l: 'Date',       v: fmtDate(selected.created_at)                                                                   },
              ].filter(Boolean).map(({ l, v, mono }) => (
                <div key={l} className="flex justify-between gap-3 py-3 border-b border-gray-800/60 last:border-0">
                  <span className="text-gray-500 text-sm shrink-0">{l}</span>
                  <span className={`text-gray-200 text-right text-sm font-semibold break-all ${mono ? 'font-mono text-xs' : ''}`}>{v}</span>
                </div>
              ))}
            </div>
            {selected.screenshot_url && (
              <div className="px-5 pb-5">
                <p className="text-xs text-gray-500 mb-2">Screenshot</p>
                <a href={selected.screenshot_url} target="_blank" rel="noreferrer">
                  <img src={selected.screenshot_url} alt="Proof"
                    className="w-full rounded-2xl max-h-52 object-contain bg-gray-800 cursor-zoom-in" />
                </a>
              </div>
            )}
            {/* Resume button inside detail modal too */}
            {selected.status === 'assigned' && (
              <div className="px-5 pb-5">
                <button
                  onClick={() => { setSelected(null); setResumeOrder(selected); }}
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-sm transition-all active:scale-95">
                  ⚡ Complete This Payment →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Resume order modal — shows bank details + proof upload */}
      {resumeOrder && resumeOrder.status === 'assigned' && (
        <ResumeOrderModal
          order={resumeOrder}
          onClose={() => setResumeOrder(null)}
          onDone={() => {
            setResumeOrder(null);
            // Refresh list
            setLoading(true);
            depositAPI.getHistory({ page, limit: 10, status: filter || undefined })
              .then(({ data }) => {
                setOrders(data.data.orders);
                setTotal(data.data.pagination.pages || 1);
              })
              .finally(() => setLoading(false));
          }}
        />
      )}
    </Layout>
  );
}

// ── Resume Order Modal ─────────────────────────────────────────
function ResumeOrderModal({ order, onClose, onDone }) {
  const [step,     setStep]     = useState('bank');   // bank | proof
  const [proofId,  setProofId]  = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [preview,  setPreview]  = useState(null);
  const [loading,  setLoading]  = useState(false);
  const fileRef = useRef();

  const bank = order.assigned_bank_snapshot || {};

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    toast.loading('Compressing...', { id: 'compress' });
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.5, maxWidthOrHeight: 1200, useWebWorker: true,
      });
      toast.dismiss('compress');
      setScreenshot(compressed);
      setPreview(URL.createObjectURL(compressed));
      toast.success(`Ready (${(compressed.size / 1024).toFixed(0)}KB)`);
    } catch {
      toast.dismiss('compress');
      toast.error('Failed to process image');
    }
  };

  const submitProof = async (e) => {
    e.preventDefault();
    if (!proofId.trim()) {
      toast.error(order.type === 'USDT' ? 'Enter TXID' : 'Enter UTR number');
      return;
    }
    if (!screenshot) {
      toast.error('Upload payment screenshot');
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('order_id', order.id);
      fd.append('screenshot', screenshot, 'proof.jpg');
      if (order.type === 'USDT') fd.append('txid', proofId);
      else                        fd.append('utr_number', proofId);

      if (order.type === 'USDT') await depositAPI.submitUSDTProof(fd);
      else                        await depositAPI.submitINRProof(fd);

      toast.success('Proof submitted! Your deposit is under review.');
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit proof');
    } finally {
      setLoading(false);
    }
  };

  const copyText = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied!');
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center p-4">
      <div className="bg-gray-900 rounded-3xl w-full max-w-lg border border-amber-800/40 overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
          <div>
            <h2 className="font-black text-white">Complete Your Payment</h2>
            <p className="text-xs text-gray-500 mt-0.5">Order #{order.order_number}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-800 text-gray-400 hover:text-white">✕</button>
        </div>

        {/* Step tabs */}
        <div className="flex border-b border-gray-800 shrink-0">
          {[{ id: 'bank', label: '1. Bank Details' }, { id: 'proof', label: '2. Upload Proof' }].map(t => (
            <button key={t.id} onClick={() => setStep(t.id)}
              className={`flex-1 py-3 text-sm font-bold transition-colors ${
                step === t.id
                  ? 'text-amber-400 border-b-2 border-amber-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1">

          {/* Step 1: Bank Details */}
          {step === 'bank' && (
            <div className="p-5">
              {/* Amount to pay */}
              <div className="rounded-2xl bg-amber-900/20 border border-amber-800/30 p-4 mb-4 text-center">
                <p className="text-amber-300 text-xs font-semibold mb-1">Amount to Transfer</p>
                <p className="text-3xl font-black text-white">
                  {order.type === 'USDT'
                    ? `₮${parseFloat(order.requested_amount).toFixed(4)}`
                    : `₹${parseFloat(order.requested_amount).toLocaleString('en-IN')}`}
                </p>
              </div>

              {/* Bank details */}
              {Object.keys(bank).length > 0 ? (
                <div className="card rounded-2xl p-4 space-y-3 mb-4">
                  <p className="text-sm font-bold text-gray-300">Transfer to this account:</p>
                  {[
                    { l: 'Bank Name',       v: bank.bank_name },
                    { l: 'Account Holder',  v: bank.account_holder },
                    { l: 'Account Number',  v: bank.account_number, copy: true },
                    { l: 'IFSC Code',       v: bank.ifsc_code, copy: true },
                    { l: 'UPI ID',          v: bank.upi_id, copy: true },
                  ].filter(r => r.v).map(({ l, v, copy }) => (
                    <div key={l} className="flex items-center justify-between gap-2">
                      <span className="text-gray-500 text-sm shrink-0">{l}</span>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-gray-200 font-semibold text-sm text-right truncate">{v}</span>
                        {copy && (
                          <button onClick={() => copyText(v)}
                            className="text-emerald-400 text-xs bg-emerald-900/30 px-2 py-1 rounded-lg border border-emerald-800/40 shrink-0 font-bold hover:bg-emerald-900/50">
                            Copy
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="card rounded-2xl p-4 mb-4 text-center">
                  <p className="text-gray-400 text-sm">Bank details not available. Contact support.</p>
                </div>
              )}

              <div className="rounded-xl bg-gray-800/50 border border-gray-700 px-4 py-3 mb-4">
                <p className="text-xs text-amber-300">⚠️ Use your order number as payment reference/remarks when transferring.</p>
              </div>

              <button onClick={() => setStep('proof')}
                className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-sm transition-all active:scale-95">
                I've Made the Payment → Upload Proof
              </button>
            </div>
          )}

          {/* Step 2: Upload Proof */}
          {step === 'proof' && (
            <form onSubmit={submitProof} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">
                  {order.type === 'USDT' ? 'Blockchain TXID' : 'UTR / Reference Number'}
                </label>
                <input type="text" required className="input"
                  placeholder={order.type === 'USDT'
                    ? 'Paste transaction hash from your wallet'
                    : 'Enter bank UTR or UPI reference number'}
                  value={proofId}
                  onChange={e => setProofId(e.target.value)} />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">Payment Screenshot</label>
                <input type="file" ref={fileRef} accept="image/*" onChange={handleFile} className="hidden" />

                {preview ? (
                  <div className="relative rounded-xl overflow-hidden">
                    <img src={preview} alt="Preview"
                      className="w-full max-h-48 object-contain bg-gray-800" />
                    <button type="button"
                      onClick={() => { setScreenshot(null); setPreview(null); fileRef.current.value = ''; }}
                      className="absolute top-2 right-2 w-8 h-8 bg-red-500 hover:bg-red-400 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      ✕
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="w-full border-2 border-dashed border-gray-700 rounded-2xl p-8 text-center hover:border-emerald-700 hover:bg-emerald-900/10 transition-all">
                    <p className="text-3xl mb-2">📸</p>
                    <p className="text-sm font-semibold text-gray-300">Tap to upload screenshot</p>
                    <p className="text-xs text-gray-600 mt-1">JPEG/PNG · Auto-compressed</p>
                  </button>
                )}
              </div>

              <button type="submit"
                disabled={loading || !screenshot || !proofId.trim()}
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm transition-all active:scale-95 disabled:opacity-40">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Submitting...
                  </span>
                ) : 'Submit Proof →'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
