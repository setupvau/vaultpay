// src/pages/DepositPage.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import imageCompression from 'browser-image-compression';
import { depositAPI } from '../services/api';
import Layout from '../components/layout/Layout';

const STEPS = {
  SELECT:  'select',
  FORM:    'form',
  WAITING: 'waiting',
  ORDER:   'order',
  PROOF:   'proof',
  DONE:    'done',
};

const fmtINR = (n) =>
  `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function DepositPage() {
  const [searchParams] = useSearchParams();
  const initialType    = searchParams.get('type');

  const [step,    setStep]    = useState(initialType ? STEPS.FORM : STEPS.SELECT);
  const [type,    setType]    = useState(initialType);
  const [loading, setLoading] = useState(false);
  const [order,   setOrder]   = useState(null);

  // USDT form
  const [usdtAmount, setUsdtAmount] = useState('');
  const [chain,      setChain]      = useState('TRC20');
  const [rateInfo,   setRateInfo]   = useState({ rate: null, bonus: 0 });

  // INR form
  const [inrAmount, setInrAmount] = useState('');

  // Proof form
  const [proofId,           setProofId]   = useState('');
  const [screenshot,        setScreenshot] = useState(null);
  const [screenshotPreview, setPreview]    = useState(null);
  const fileInputRef = useRef();

  // Polling for INR waiting
  const [pollCount, setPollCount] = useState(0);
  const [timeLeft,  setTimeLeft]  = useState(null);
  const pollRef  = useRef(null);
  const timerRef = useRef(null);

  // Fetch USDT rate when USDT form opens
  useEffect(() => {
    if (type === 'usdt') {
      depositAPI.getUSDTRate()
        .then(({ data }) => setRateInfo({ rate: data.rate, bonus: data.bonus_percent || 0 }))
        .catch(() => setRateInfo({ rate: 110, bonus: 0 }));
    }
  }, [type]);

  const stopPolling = useCallback(() => {
    if (pollRef.current)  clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const startPolling = useCallback((orderId) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await depositAPI.checkINROrder(orderId);
        const o = data.data;
        if (o.status === 'assigned') {
          stopPolling();
          setOrder(prev => ({ ...prev, ...o }));
          setStep(STEPS.ORDER);
          toast.success('Bank account assigned! Please make payment now.');
        } else if (o.status === 'cancelled') {
          stopPolling();
          toast.error('Order expired. Please create a new order.');
          setStep(STEPS.FORM);
        }
        setPollCount(c => c + 1);
      } catch {}
    }, 8000);
  }, [stopPolling]);

  // Countdown timer once bank assigned
  useEffect(() => {
    if (step === STEPS.ORDER && order?.expires_at) {
      timerRef.current = setInterval(() => {
        const diff = Math.max(0, new Date(order.expires_at) - Date.now());
        setTimeLeft(diff);
        if (diff === 0) {
          clearInterval(timerRef.current);
          toast.error('Payment window expired. Order cancelled.');
          setStep(STEPS.FORM);
        }
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [step, order?.expires_at]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const formatTimeLeft = (ms) => {
    if (!ms) return '';
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleFileSelect = async (e) => {
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

  const submitUSDT = async (e) => {
    e.preventDefault();
    if (!usdtAmount || parseFloat(usdtAmount) <= 0) return toast.error('Enter a valid amount');
    setLoading(true);
    try {
      const { data } = await depositAPI.createUSDT({
        amount_usdt: parseFloat(usdtAmount),
        chain_type: chain,
      });
      setOrder(data.data);
      // Update rate from actual order response
      if (data.data.usdt_rate) {
        setRateInfo({ rate: data.data.usdt_rate, bonus: data.data.bonus_amount || 0 });
      }
      setStep(STEPS.ORDER);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create order');
    } finally { setLoading(false); }
  };

  const submitINR = async (e) => {
    e.preventDefault();
    if (!inrAmount || parseFloat(inrAmount) < 500) return toast.error('Minimum INR deposit is ₹500');
    setLoading(true);
    try {
      const { data } = await depositAPI.createINR({ amount_inr: parseFloat(inrAmount) });
      setOrder(data.data);
      if (data.data.status === 'assigned') {
        setStep(STEPS.ORDER);
        toast.success('Bank account ready!');
      } else {
        setStep(STEPS.WAITING);
        startPolling(data.data.order_id);
        toast('Order placed! Waiting for bank assignment...', { icon: '⏳' });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create order');
    } finally { setLoading(false); }
  };

  const submitProof = async (e) => {
    e.preventDefault();
    if (!proofId.trim()) return toast.error(type === 'usdt' ? 'Enter TXID' : 'Enter UTR number');
    if (!screenshot)     return toast.error('Upload payment screenshot');
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('order_id', order.order_id);
      fd.append('screenshot', screenshot, 'proof.jpg');
      if (type === 'usdt') fd.append('txid', proofId);
      else                  fd.append('utr_number', proofId);

      if (type === 'usdt') await depositAPI.submitUSDTProof(fd);
      else                  await depositAPI.submitINRProof(fd);

      stopPolling();
      setStep(STEPS.DONE);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit proof');
    } finally { setLoading(false); }
  };

  // ── SELECT ──────────────────────────────────────────────────
  if (step === STEPS.SELECT) return (
    <Layout>
      <div className="max-w-lg mx-auto px-4 py-5">
        <div className="flex items-center gap-3 mb-6 pt-1">
          <Link to="/dashboard"
            className="w-9 h-9 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-400 hover:text-white">
            ←
          </Link>
          <div>
            <h1 className="text-xl font-black text-white">Make a Deposit</h1>
            <p className="text-gray-500 text-xs">Choose your deposit method</p>
          </div>
        </div>

        <div className="space-y-3">
          {[
            { t: 'inr',  icon: '🏦', title: 'Deposit INR',  desc: 'Bank transfer / UPI',        color: 'border-emerald-800/40 hover:border-emerald-600' },
            { t: 'usdt', icon: '₮',  title: 'Deposit USDT', desc: 'TRC20 or BEP20', color: 'border-yellow-800/40 hover:border-yellow-600'  },
          ].map(({ t, icon, title, desc, color }) => (
            <button key={t}
              onClick={() => { setType(t); setStep(STEPS.FORM); }}
              className={`w-full card rounded-2xl p-5 text-left group transition-all hover:brightness-110 border ${color}`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 ${t === 'inr' ? 'bg-emerald-900/40' : 'bg-yellow-900/40'}`}>
                  {icon}
                </div>
                <div className="flex-1">
                  <p className="font-black text-white">{title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                </div>
                <span className="text-gray-600 group-hover:text-white transition-colors text-lg">→</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </Layout>
  );

  // ── USDT FORM ───────────────────────────────────────────────
  if (step === STEPS.FORM && type === 'usdt') return (
    <Layout>
      <div className="max-w-lg mx-auto px-4 py-5">
        <div className="flex items-center gap-3 mb-5 pt-1">
          <button onClick={() => setStep(STEPS.SELECT)}
            className="w-9 h-9 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-400 hover:text-white">
            ←
          </button>
          <div>
            <h1 className="text-xl font-black text-white">Deposit USDT</h1>
            <p className="text-gray-500 text-xs">Credited as INR at current rate</p>
          </div>
        </div>

        <form onSubmit={submitUSDT} className="space-y-4">
          <div className="card rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-bold text-gray-300">Amount (USDT)</p>
              <span className="text-xs bg-yellow-900/40 text-yellow-400 border border-yellow-800/40 px-2.5 py-1 rounded-full font-semibold">
                {rateInfo.rate
                  ? `Rate: 1 USDT = ₹${rateInfo.rate}`
                  : <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 border border-yellow-400/40 border-t-yellow-400 rounded-full animate-spin" />
                      Loading rate...
                    </span>
                }
              </span>
            </div>

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-yellow-400 font-black text-lg">₮</span>
              <input type="number" step="0.01" min="1" required
                className="input pl-9 text-xl font-black"
                placeholder="0.00"
                value={usdtAmount}
                onChange={e => setUsdtAmount(e.target.value)} />
            </div>

            {/* Live INR equivalent */}
            {usdtAmount && rateInfo.rate && parseFloat(usdtAmount) > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-800 flex items-center justify-between">
                <p className="text-xs text-gray-500">You will receive (INR)</p>
                <p className="text-emerald-400 font-black">
                  ₹{(parseFloat(usdtAmount) * rateInfo.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
            )}
          </div>

          <div className="card rounded-2xl p-5">
            <p className="text-sm font-bold text-gray-300 mb-3">Select Network</p>
            <div className="grid grid-cols-2 gap-3">
              {['TRC20', 'BEP20'].map(c => (
                <button key={c} type="button" onClick={() => setChain(c)}
                  className={`rounded-xl border py-3.5 font-bold text-sm transition-all ${
                    chain === c
                      ? 'border-yellow-500 bg-yellow-900/20 text-yellow-300'
                      : 'border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}>
                  {c}
                  <p className="text-xs font-normal text-gray-500 mt-0.5">
                    {c === 'TRC20' ? 'Tron (TRX)' : 'Lower fees'}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-4 text-base">
            {loading ? <Spinner /> : 'Continue →'}
          </button>
        </form>
      </div>
    </Layout>
  );

  // ── INR FORM ────────────────────────────────────────────────
  if (step === STEPS.FORM && type === 'inr') return (
    <Layout>
      <div className="max-w-lg mx-auto px-4 py-5">
        <div className="flex items-center gap-3 mb-5 pt-1">
          <button onClick={() => setStep(STEPS.SELECT)}
            className="w-9 h-9 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-400 hover:text-white">
            ←
          </button>
          <div>
            <h1 className="text-xl font-black text-white">Deposit INR</h1>
            <p className="text-gray-500 text-xs">Bank transfer or UPI</p>
          </div>
        </div>

        <div className="rounded-2xl bg-blue-900/20 border border-blue-800/30 p-4 mb-4">
          <p className="text-blue-300 font-bold text-sm mb-2">How it works</p>
          <div className="space-y-1.5">
            {[
              'Enter your deposit amount',
              'We assign you a bank account (1–5 min)',
              'Transfer the exact amount',
              'Upload your payment screenshot',
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-800 text-blue-300 text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold">
                  {i + 1}
                </span>
                <p className="text-xs text-blue-300/80">{s}</p>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={submitINR} className="space-y-4">
          <div className="card rounded-2xl p-5">
            <p className="text-sm font-bold text-gray-300 mb-3">Deposit Amount</p>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400 font-black text-lg">₹</span>
              <input type="number" min="500" step="1" required
                className="input pl-9 text-xl font-black"
                placeholder="Minimum ₹1000"
                value={inrAmount}
                onChange={e => setInrAmount(e.target.value)} />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-4 text-base">
            {loading ? <Spinner /> : 'Place Order →'}
          </button>
        </form>
      </div>
    </Layout>
  );

  // ── WAITING FOR BANK ────────────────────────────────────────
  if (step === STEPS.WAITING) return (
    <Layout>
      <div className="max-w-lg mx-auto px-4 py-10 text-center">
        <div className="w-20 h-20 mx-auto mb-6 relative">
          <div className="w-20 h-20 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin" />
          <span className="absolute inset-0 flex items-center justify-center text-2xl">🏦</span>
        </div>

        <h1 className="text-2xl font-black text-white mb-2">Assigning Bank Account</h1>
        <p className="text-gray-400 mb-1">Our team is assigning a bank account to your order.</p>
        <p className="text-gray-500 text-sm mb-6">This usually takes 1–5 minutes.</p>

        <div className="card rounded-2xl p-5 text-left mb-6 space-y-3 text-sm">
          <R label="Order No." value={order?.order_number} mono />
          <R label="Amount"    value={fmtINR(order?.amount)} />
          <R label="Status"    value="⏳ Waiting for assignment" />
        </div>

        <div className="text-xs text-gray-600 flex items-center justify-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Checking for updates... ({pollCount} checks)
        </div>
        <p className="text-xs text-gray-700 mt-3">This page auto-updates. Keep it open.</p>

        <button onClick={() => { stopPolling(); setStep(STEPS.FORM); }}
          className="mt-6 text-xs text-gray-600 hover:text-red-400 transition-colors">
          Cancel order
        </button>
      </div>
    </Layout>
  );

  // ── ORDER DETAILS ───────────────────────────────────────────
  if (step === STEPS.ORDER) return (
    <Layout>
      <div className="max-w-lg mx-auto px-4 py-5">
        <div className="flex items-center gap-3 mb-5 pt-1">
          <div>
            <h1 className="text-xl font-black text-white">
              {type === 'usdt' ? 'Send USDT' : 'Transfer Money'}
            </h1>
            <p className="text-gray-500 text-xs">Complete your payment then upload proof</p>
          </div>
        </div>

        {/* Countdown for INR */}
        {type === 'inr' && order?.expires_at && timeLeft !== null && (
          <div className={`rounded-2xl p-4 mb-4 text-center border ${
            timeLeft < 300000
              ? 'bg-red-900/20 border-red-800/40'
              : 'bg-amber-900/20 border-amber-800/30'
          }`}>
            <p className={`text-2xl font-black ${timeLeft < 300000 ? 'text-red-400' : 'text-amber-400'}`}>
              ⏱ {formatTimeLeft(timeLeft)}
            </p>
            <p className={`text-xs mt-0.5 ${timeLeft < 300000 ? 'text-red-400/70' : 'text-amber-400/60'}`}>
              Time remaining to complete payment
            </p>
          </div>
        )}

        {/* Order card */}
        <div className="card rounded-2xl overflow-hidden mb-4">
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-5 py-4 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <p className="text-gray-400 text-xs font-medium">Amount to Transfer</p>
              <span className="text-xs text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded-full border border-emerald-800/40">
                ✓ {type === 'usdt' ? 'Address Ready' : 'Bank Assigned'}
              </span>
            </div>
            <p className="text-3xl font-black text-white mt-1">
              {type === 'usdt' ? `₮ ${order?.amount_usdt}` : fmtINR(order?.amount)}
            </p>
            {type === 'usdt' && order?.inr_equivalent && (
              <p className="text-emerald-400 text-sm mt-0.5">
                ≈ ₹{parseFloat(order.inr_equivalent).toLocaleString('en-IN')} at rate ₹{order.usdt_rate}
              </p>
            )}
          </div>

          <div className="p-5 space-y-3 text-sm">
            {type === 'usdt' && (
              <>
                <CopyRow label="Address" value={order?.wallet_address} />
                <InfoRow label="Network" value={order?.chain_type} />
              </>
            )}
            {type === 'inr' && order?.bank_details && (
              <>
                {order.bank_details.bank_name && (
                  <InfoRow label="Bank" value={order.bank_details.bank_name} />
                )}
                {order.bank_details.account_holder && (
                  <InfoRow label="Account Holder" value={order.bank_details.account_holder} />
                )}
                {order.bank_details.account_number && (
                  <CopyRow label="Account No." value={order.bank_details.account_number} />
                )}
                {order.bank_details.ifsc_code && (
                  <CopyRow label="IFSC Code" value={order.bank_details.ifsc_code} />
                )}
                {order.bank_details.upi_id && (
                  <CopyRow label="UPI ID" value={order.bank_details.upi_id} />
                )}
              </>
            )}
            <InfoRow label="Order No." value={order?.order_number} mono />
          </div>
        </div>

        <div className="rounded-xl bg-amber-900/20 border border-amber-800/30 p-3 mb-4 text-xs text-amber-300">
          ⚠️ Transfer the EXACT amount shown. Use your order number as payment reference/remarks.
        </div>

        <button onClick={() => setStep(STEPS.PROOF)} className="btn-primary w-full py-4 text-base">
          I've Made the Payment — Upload Proof →
        </button>
      </div>
    </Layout>
  );

  // ── UPLOAD PROOF ────────────────────────────────────────────
  if (step === STEPS.PROOF) return (
    <Layout>
      <div className="max-w-lg mx-auto px-4 py-5">
        <div className="flex items-center gap-3 mb-5 pt-1">
          <button onClick={() => setStep(STEPS.ORDER)}
            className="w-9 h-9 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-400 hover:text-white">
            ←
          </button>
          <div>
            <h1 className="text-xl font-black text-white">Upload Proof</h1>
            <p className="text-gray-500 text-xs">Screenshot + reference number</p>
          </div>
        </div>

        <form onSubmit={submitProof} className="space-y-4">
          <div className="card rounded-2xl p-5">
            <label className="block text-sm font-bold text-gray-300 mb-2">
              {type === 'usdt' ? 'Blockchain TXID' : 'UTR / Reference Number'}
            </label>
            <input type="text" className="input" required
              placeholder={type === 'usdt'
                ? 'Paste transaction hash from your wallet'
                : 'Enter bank UTR or UPI reference number'}
              value={proofId}
              onChange={e => setProofId(e.target.value)} />
          </div>

          <div className="card rounded-2xl p-5">
            <label className="block text-sm font-bold text-gray-300 mb-3">Payment Screenshot</label>
            <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileSelect} className="hidden" />

            {screenshotPreview ? (
              <div className="relative rounded-xl overflow-hidden">
                <img src={screenshotPreview} alt="Preview"
                  className="w-full max-h-64 object-contain bg-gray-800" />
                <button type="button"
                  onClick={() => { setScreenshot(null); setPreview(null); fileInputRef.current.value = ''; }}
                  className="absolute top-2 right-2 w-8 h-8 bg-red-500 hover:bg-red-400 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  ✕
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-700 rounded-2xl p-10 text-center hover:border-emerald-700 hover:bg-emerald-900/10 transition-all">
                <p className="text-4xl mb-3">📸</p>
                <p className="text-sm font-semibold text-gray-300">Tap to upload screenshot</p>
                <p className="text-xs text-gray-600 mt-1">JPEG/PNG · Auto-compressed before upload</p>
              </button>
            )}
          </div>

          <button type="submit" disabled={loading || !screenshot}
            className="btn-primary w-full py-4 text-base disabled:opacity-40">
            {loading ? <Spinner /> : 'Submit Proof →'}
          </button>
        </form>
      </div>
    </Layout>
  );

  // ── DONE ────────────────────────────────────────────────────
  if (step === STEPS.DONE) return (
    <Layout>
      <div className="max-w-lg mx-auto px-4 py-10 text-center">
        <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center text-5xl mx-auto mb-5 border border-emerald-500/20">
          ✅
        </div>
        <h1 className="text-2xl font-black text-white mb-2">Proof Submitted!</h1>
        <p className="text-gray-400 mb-1">Your deposit is under review.</p>
        <p className="text-gray-500 text-sm mb-8">
          Usually confirmed within 1 hour. You'll get a notification.
        </p>
        <div className="flex gap-3 justify-center">
          <Link to="/history"   className="btn-secondary text-sm px-5">View History</Link>
          <Link to="/dashboard" className="btn-primary  text-sm px-5">Back Home</Link>
        </div>
      </div>
    </Layout>
  );

  return null;
}

// ── Helpers ─────────────────────────────────────────────────────
function Spinner() {
  return (
    <span className="flex items-center justify-center gap-2">
      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      Processing...
    </span>
  );
}

function CopyRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-gray-500 shrink-0 text-sm">{label}</span>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-gray-200 font-semibold text-sm text-right truncate">{value}</span>
        <button type="button"
          onClick={() => { navigator.clipboard.writeText(value); toast.success('Copied!'); }}
          className="text-emerald-400 hover:text-emerald-300 shrink-0 text-xs bg-emerald-900/30 px-2 py-1 rounded-lg border border-emerald-800/40 font-bold">
          Copy
        </button>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-gray-500 shrink-0 text-sm">{label}</span>
      <span className={`text-gray-200 font-semibold text-sm text-right ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </span>
    </div>
  );
}

function R({ label, value, mono }) {
  return (
    <div className="flex justify-between gap-2 py-1.5 border-b border-gray-800 last:border-0">
      <span className="text-gray-500 shrink-0 text-sm">{label}</span>
      <span className={`text-gray-200 font-semibold text-sm text-right break-all ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </span>
    </div>
  );
}
