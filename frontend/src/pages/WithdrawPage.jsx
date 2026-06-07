// src/pages/WithdrawPage.jsx — INR only
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { withdrawalAPI, walletAPI } from '../services/api';
import Layout from '../components/layout/Layout';

const fmtINR = (n) =>
  `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function WithdrawPage() {
  const [balance, setBalance]   = useState(null);
  const [step, setStep]         = useState('form'); // form | done
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [method, setMethod]     = useState('bank');
  const [amount, setAmount]     = useState('');
  const [bank, setBank]         = useState({ bank_name: '', account_holder: '', account_number: '', ifsc_code: '' });
  const [upi, setUpi]           = useState('');

  useEffect(() => {
    walletAPI.getBalance().then(r => setBalance(r.data.data));
  }, []);

  const availableINR = balance ? parseFloat(balance.balance_inr) : 0;
  const setMax = () => setAmount(availableINR.toFixed(2));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0)        return toast.error('Enter a valid amount');
    if (amt > availableINR)      return toast.error('Amount exceeds your INR balance');
    if (amt < 1000)               return toast.error('Minimum withdrawal is ₹1000');

    const payload = { amount: amt, method };
    if (method === 'bank') Object.assign(payload, bank);
    if (method === 'upi')  payload.upi_id = upi;

    setLoading(true);
    try {
      const { data } = await withdrawalAPI.create(payload);
      setResult(data.data);
      setStep('done');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit');
    } finally {
      setLoading(false);
    }
  };

  // ── Done screen ──────────────────────────────────────────────
  if (step === 'done') return (
    <Layout>
      <div className="max-w-lg mx-auto px-4 py-10 text-center">
        <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center text-4xl mx-auto mb-5 border border-emerald-500/20">
          ✅
        </div>
        <h1 className="text-2xl font-black text-white mb-2">Request Submitted!</h1>
        <p className="text-gray-400 mb-1">Your withdrawal is being processed.</p>
        <p className="text-gray-500 text-sm mb-6">Usually completed within 24 hours.</p>

        <div className="card rounded-2xl p-5 text-left mb-6 space-y-3 text-sm">
          <R label="Order No." value={result?.order_number} mono />
          <R label="Amount"    value={fmtINR(result?.amount)} />
          <R label="Method"    value={method === 'bank' ? '🏦 Bank Transfer' : '📲 UPI'} />
          <R label="Status"    value="Pending Review" />
        </div>

        <div className="flex gap-3 justify-center">
          <Link to="/withdraw/history" className="btn-secondary text-sm px-5">View History</Link>
          <Link to="/dashboard"        className="btn-primary  text-sm px-5">Back Home</Link>
        </div>
      </div>
    </Layout>
  );

  // ── Form screen ──────────────────────────────────────────────
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
            <h1 className="text-xl font-black text-white">Withdraw Funds</h1>
            <p className="text-gray-500 text-xs">INR · Processed within 24 hours</p>
          </div>
          <Link to="/withdraw/history" className="ml-auto text-xs text-gray-500 hover:text-emerald-400 font-medium transition-colors">
            History →
          </Link>
        </div>

        {/* Balance display */}
        <div className="rounded-2xl bg-gradient-to-r from-emerald-900/30 to-teal-900/20 border border-emerald-800/30 px-5 py-4 mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Available INR Balance</p>
            <p className="text-2xl font-black text-emerald-400 mt-0.5">{fmtINR(availableINR)}</p>
          </div>
          <span className="text-3xl">🏦</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Amount input */}
          <div className="card rounded-2xl p-5">
            <label className="block text-sm font-bold text-gray-300 mb-3">Withdrawal Amount</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black text-lg">₹</span>
              <input
                type="number" step="1" min="500" required
                className="input pl-9 pr-20 text-xl font-black"
                placeholder="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
              <button type="button" onClick={setMax}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs bg-emerald-900/50 text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-800 hover:bg-emerald-900 transition-colors font-bold">
                MAX
              </button>
            </div>
            {amount && parseFloat(amount) > availableINR && (
              <p className="text-red-400 text-xs mt-2 font-medium">⚠️ Exceeds available balance</p>
            )}
            {amount && parseFloat(amount) < 500 && parseFloat(amount) > 0 && (
              <p className="text-amber-400 text-xs mt-2 font-medium">⚠️ Minimum withdrawal is ₹500</p>
            )}
            <p className="text-gray-600 text-xs mt-2">Minimum withdrawal: ₹1000</p>
          </div>

          {/* Method selector */}
          <div className="card rounded-2xl p-5">
            <p className="text-sm font-bold text-gray-300 mb-3">Withdrawal Method</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'bank', icon: '🏦', title: 'Bank Transfer', desc: 'NEFT / IMPS' },
                { id: 'upi',  icon: '📲', title: 'UPI',           desc: 'Instant transfer' },
              ].map(m => (
                <button key={m.id} type="button" onClick={() => setMethod(m.id)}
                  className={`rounded-xl border p-4 text-left transition-all ${
                    method === m.id
                      ? 'border-emerald-500 bg-emerald-900/20'
                      : 'border-gray-700 bg-gray-800/40 hover:border-gray-600'
                  }`}>
                  <span className="text-2xl block mb-2">{m.icon}</span>
                  <p className="text-sm font-bold text-white">{m.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{m.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Bank details */}
          {method === 'bank' && (
            <div className="card rounded-2xl p-5 space-y-3">
              <p className="text-sm font-bold text-gray-300">Bank Account Details</p>
              {[
                { key: 'bank_name',      label: 'Bank Name',           placeholder: 'e.g. HDFC Bank'       },
                { key: 'account_holder', label: 'Account Holder Name', placeholder: 'Exactly as on passbook' },
                { key: 'account_number', label: 'Account Number',      placeholder: 'Account number'        },
                { key: 'ifsc_code',      label: 'IFSC Code',           placeholder: 'e.g. HDFC0001234'      },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-500 mb-1.5 font-medium">{label}</label>
                  <input type="text" required className="input"
                    placeholder={placeholder}
                    value={bank[key]}
                    onChange={e => setBank({ ...bank, [key]: e.target.value })} />
                </div>
              ))}
            </div>
          )}

          {/* UPI details */}
          {method === 'upi' && (
            <div className="card rounded-2xl p-5">
              <p className="text-sm font-bold text-gray-300 mb-3">UPI Details</p>
              <label className="block text-xs text-gray-500 mb-1.5 font-medium">UPI ID</label>
              <input type="text" required className="input"
                placeholder="yourname@upi or 9876543210@paytm"
                value={upi}
                onChange={e => setUpi(e.target.value)} />
              <p className="text-xs text-gray-600 mt-2">Make sure this UPI ID is active and can receive money</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !amount || parseFloat(amount) < 500 || parseFloat(amount) > availableINR}
            className="btn-primary w-full py-4 text-base font-black">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Submitting...
              </span>
            ) : `Withdraw ₹${parseFloat(amount || 0).toLocaleString('en-IN')} →`}
          </button>
        </form>
      </div>
    </Layout>
  );
}

function R({ label, value, mono }) {
  return (
    <div className="flex justify-between gap-2 py-1.5 border-b border-gray-800 last:border-0">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className={`text-gray-200 text-right font-semibold ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  );
}
