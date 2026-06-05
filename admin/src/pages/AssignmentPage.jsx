// admin/src/pages/AssignmentPage.jsx
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { api } from '../context/AdminAuthContext';
import AdminLayout from '../components/layout/AdminLayout';

export default function AssignmentPage() {
  const [data, setData]         = useState({ pending_orders: [], pending_withdrawals: [] });
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null); // order being assigned
  const [banks, setBanks]       = useState([]);
  const [tab, setTab]           = useState('saved'); // saved | p2p | custom
  const [customBank, setCustom] = useState({ bank_name:'', account_holder:'', account_number:'', ifsc_code:'', upi_id:'' });
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/admin/deposits/pending-assignments'),
      api.get('/admin/bank-accounts'),
    ]).then(([d, b]) => {
      setData(d.data.data);
      setBanks(b.data.data.filter(b => b.is_active));
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Auto-refresh every 15s
  useEffect(() => {
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  const fmtINR = (n) => `₹${parseFloat(n||0).toLocaleString('en-IN',{minimumFractionDigits:2})}`;
  const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});

  const assign = async (payload) => {
    setSubmitting(true);
    try {
      await api.post(`/admin/deposits/${selected.id}/assign`, payload);
      toast.success('✅ Bank assigned! User has been notified.');
      setSelected(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign');
    } finally { setSubmitting(false); }
  };

  const assignSavedBank = (bankId) => assign({ bank_account_id: bankId });
  const assignP2P       = (wId)    => assign({ withdrawal_id: wId });
  const assignCustom    = (e)      => { e.preventDefault(); assign({ custom_bank: customBank }); };

  return (
    <AdminLayout title="Order Assignment">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-gray-400 text-sm">Orders waiting for bank account assignment</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-gray-500">Auto-refreshes every 15s</span>
        </div>
      </div>

      {/* P2P suggestion banner */}
      {data.pending_withdrawals.length > 0 && data.pending_orders.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-r from-purple-900/30 to-indigo-900/30 border border-purple-800/40 p-4 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🔄</span>
            <div>
              <p className="font-black text-purple-300">P2P Matching Available!</p>
              <p className="text-sm text-purple-400/80 mt-0.5">
                You have {data.pending_withdrawals.length} pending withdrawal(s) and {data.pending_orders.length} pending deposit(s).
                You can match them — the deposit goes directly to the withdrawer's account.
                No extra funds needed!
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Pending Orders */}
        <div>
          <h2 className="font-black text-white mb-4 flex items-center gap-2">
            ⬇️ Pending Deposit Orders
            {data.pending_orders.length > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{data.pending_orders.length}</span>
            )}
          </h2>

          {loading ? (
            <div className="space-y-3">{[...Array(3)].map((_,i) => <div key={i} className="h-20 bg-gray-900 rounded-2xl animate-pulse" />)}</div>
          ) : data.pending_orders.length === 0 ? (
            <div className="card rounded-2xl p-8 text-center">
              <p className="text-3xl mb-2">✅</p>
              <p className="text-gray-400 font-semibold">All caught up!</p>
              <p className="text-gray-600 text-sm mt-1">No orders waiting for assignment</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.pending_orders.map(o => (
                <div key={o.id} className="card rounded-2xl p-4 border-amber-800/30 bg-amber-900/10">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-black text-white">{o.full_name}</p>
                      <p className="text-xs text-gray-400">{o.phone}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-amber-400 text-lg">{fmtINR(o.requested_amount)}</p>
                      <p className="text-xs text-gray-500">{fmtDate(o.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-xs text-gray-500">{o.order_number}</p>
                    <button onClick={() => { setSelected(o); setTab('saved'); }}
                      className="btn-primary text-xs px-4 py-2">
                      Assign Bank →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Withdrawals (for P2P reference) */}
        <div>
          <h2 className="font-black text-white mb-4 flex items-center gap-2">
            ⬆️ Pending Withdrawals
            <span className="text-xs text-gray-500 font-normal">(available for P2P matching)</span>
          </h2>

          {data.pending_withdrawals.length === 0 ? (
            <div className="card rounded-2xl p-8 text-center">
              <p className="text-gray-400 text-sm">No pending withdrawals</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.pending_withdrawals.map(w => (
                <div key={w.id} className="card rounded-2xl p-4 border-blue-800/30 bg-blue-900/10">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-black text-white">{w.full_name}</p>
                      <p className="text-xs text-gray-400">{w.phone}</p>
                    </div>
                    <p className="font-black text-blue-400">{fmtINR(w.amount)}</p>
                  </div>
                  <div className="text-xs text-gray-500 space-y-0.5">
                    {w.method === 'upi'
                      ? <p>📲 UPI: {w.upi_id}</p>
                      : <p>🏦 {w.bank_name} · {w.account_number}</p>
                    }
                  </div>
                  <p className="font-mono text-xs text-gray-600 mt-1">{w.order_number}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Assignment Modal ── */}
      {selected && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}>
          <div className="bg-gray-900 rounded-3xl w-full max-w-xl border border-gray-700 overflow-hidden max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div className="px-6 py-5 border-b border-gray-800 shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-black text-white text-lg">Assign Bank Account</h2>
                  <p className="text-gray-400 text-sm mt-0.5">{selected.full_name} — {fmtINR(selected.requested_amount)}</p>
                </div>
                <button onClick={() => setSelected(null)}
                  className="w-8 h-8 rounded-full bg-gray-800 text-gray-400 hover:text-white flex items-center justify-center">✕</button>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 mt-4">
                {[
                  { id:'saved',  label:'💾 Saved Banks'   },
                  { id:'p2p',    label:'🔄 P2P Match'     },
                  { id:'custom', label:'✏️ Custom Details' },
                ].map(t => (
                  <button key={t.id} onClick={() => setTab(t.id)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${tab===t.id ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div className="overflow-y-auto flex-1 p-6">

              {/* SAVED BANKS */}
              {tab === 'saved' && (
                <div className="space-y-3">
                  {banks.length === 0 && (
                    <p className="text-center text-gray-500 py-8">No active bank accounts. Add one in Settings.</p>
                  )}
                  {banks.map(b => (
                    <div key={b.id} className="rounded-2xl border border-gray-700 p-4 hover:border-indigo-600 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="font-bold text-white text-sm">{b.bank_name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{b.account_holder}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{b.account_number} · {b.ifsc_code}</p>
                          {b.upi_id && <p className="text-xs text-emerald-400 mt-0.5">UPI: {b.upi_id}</p>}
                          <div className="flex gap-2 mt-1">
                            <span className="text-xs text-gray-600">Limit: {fmtINR(b.daily_limit)}</span>
                            <span className="text-xs text-gray-600">Used: {fmtINR(b.current_daily_total)}</span>
                          </div>
                        </div>
                        <button onClick={() => assignSavedBank(b.id)} disabled={submitting}
                          className="btn-primary text-xs px-4 py-2 shrink-0 ml-3">
                          {submitting ? '...' : 'Assign'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* P2P MATCHING */}
              {tab === 'p2p' && (
                <div>
                  <div className="rounded-2xl bg-purple-900/20 border border-purple-800/30 p-4 mb-4">
                    <p className="text-purple-300 font-bold text-sm mb-1">🔄 How P2P Works</p>
                    <p className="text-xs text-purple-400/80 leading-relaxed">
                      Match this deposit order with a pending withdrawal.
                      The depositor sends money to the withdrawer's bank.
                      You approve both — zero extra funds needed!
                    </p>
                  </div>

                  {data.pending_withdrawals.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No pending withdrawals available for P2P matching.</p>
                  ) : (
                    <div className="space-y-3">
                      {data.pending_withdrawals.map(w => {
                        const amtMatch = Math.abs(parseFloat(w.amount) - parseFloat(selected.requested_amount)) < 1;
                        return (
                          <div key={w.id} className={`rounded-2xl border p-4 transition-colors ${amtMatch ? 'border-purple-600 bg-purple-900/20' : 'border-gray-700'}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-bold text-white text-sm">{w.full_name}</p>
                                  {amtMatch && <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full font-bold">Amount Match!</span>}
                                </div>
                                <p className="text-xs text-gray-400">{w.phone}</p>
                                <p className="text-purple-300 font-bold mt-1">{fmtINR(w.amount)}</p>
                                <div className="text-xs text-gray-500 mt-1">
                                  {w.method==='upi'
                                    ? <p>📲 UPI: {w.upi_id}</p>
                                    : <><p>🏦 {w.bank_name}</p><p>{w.account_holder} · {w.account_number}</p></>
                                  }
                                </div>
                              </div>
                              <button onClick={() => assignP2P(w.id)} disabled={submitting}
                                className="shrink-0 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors">
                                {submitting ? '...' : 'Match →'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* CUSTOM BANK */}
              {tab === 'custom' && (
                <form onSubmit={assignCustom} className="space-y-3">
                  <p className="text-xs text-gray-500 mb-2">Enter any bank details manually for this order only.</p>
                  {[
                    { key:'bank_name',      label:'Bank Name',     placeholder:'e.g. HDFC Bank'    },
                    { key:'account_holder', label:'Account Holder',placeholder:'Full name'          },
                    { key:'account_number', label:'Account Number',placeholder:'Account number'     },
                    { key:'ifsc_code',      label:'IFSC Code',     placeholder:'e.g. HDFC0001234'  },
                    { key:'upi_id',         label:'UPI ID',        placeholder:'Optional'           },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <label className="block text-xs text-gray-400 mb-1 font-medium">{label}</label>
                      <input type="text" className="input"
                        placeholder={placeholder}
                        required={key !== 'upi_id'}
                        value={customBank[key]}
                        onChange={e => setCustom({ ...customBank, [key]: e.target.value })} />
                    </div>
                  ))}
                  <button type="submit" disabled={submitting}
                    className="btn-primary w-full py-3 mt-2">
                    {submitting ? 'Assigning...' : 'Assign Custom Bank →'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
