// admin/src/pages/SettingsPage.jsx
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { api } from '../context/AdminAuthContext';
import AdminLayout from '../components/layout/AdminLayout';

export default function SettingsPage() {
  const [settings, setSettings]     = useState([]);
  const [banks, setBanks]           = useState([]);
  const [addresses, setAddresses]   = useState({ TRC20: '', BEP20: '' });
  const [loading, setLoading]       = useState(true);
  const [editKey, setEditKey]       = useState(null);
  const [editValue, setEditValue]   = useState('');
  const [bankForm, setBankForm]     = useState({ bank_name: '', account_holder: '', account_number: '', ifsc_code: '', upi_id: '', daily_limit: '100000', whatsapp_number: '' });
  const [addrForm, setAddrForm]     = useState({ chain_type: 'TRC20', address: '', label: '' });
  const [showBankForm, setShowBankForm] = useState(false);

  const load = () => {
    Promise.all([api.get('/admin/settings'), api.get('/admin/bank-accounts')])
      .then(([sRes, bRes]) => {
        setSettings(sRes.data.data);
        setBanks(bRes.data.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const saveSettings = async (key, value) => {
    try {
      await api.put(`/admin/settings/${key}`, { value });
      toast.success('Setting updated');
      setEditKey(null);
      load();
    } catch {
      toast.error('Failed to update');
    }
  };

  const saveAddress = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/usdt-addresses', addrForm);
      toast.success(`${addrForm.chain_type} address updated`);
    } catch {
      toast.error('Failed to update address');
    }
  };

  const saveBank = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/bank-accounts', bankForm);
      toast.success('Bank account added');
      setShowBankForm(false);
      load();
    } catch {
      toast.error('Failed to add bank account');
    }
  };

  const toggleBank = async (id, is_active) => {
    try {
      await api.patch(`/admin/bank-accounts/${id}`, { is_active: !is_active });
      toast.success('Bank account updated');
      load();
    } catch {
      toast.error('Failed');
    }
  };

  const FRIENDLY_LABELS = {
    usdt_rate_inr:         '💱 USDT → INR Exchange Rate',
    usdt_bonus_percent:    '🎁 USDT Deposit Bonus %',
    inr_daily_profit:      '📈 INR Daily Profit %',
    inr_withdrawal_delay:  '🔒 INR Withdrawal Lock (days)',
    min_deposit_inr:       '⬇️ Min INR Deposit (₹)',
    min_deposit_usdt:      '⬇️ Min USDT Deposit',
    max_deposit_inr:       '⬆️ Max INR Deposit (₹)',
    min_withdrawal_inr:    '⬆️ Min INR Withdrawal (₹)',
    withdrawal_fee_inr:    '💸 Withdrawal Fee (₹)',
    withdrawal_enabled:    '✅ Withdrawals Enabled (true/false)',
    bank_limit_threshold:  '🏦 Bank Full Threshold (%)',
    whatsapp_number:       '📱 WhatsApp (bank redirect)',
    support_whatsapp:      '💬 Support WhatsApp Number',
    support_telegram:      '✈️ Support Telegram Username',
    support_enabled:       '🆘 Show Support Section (true/false)',
    maintenance_mode:      '🚧 Maintenance Mode (true/false)',
    allow_registrations:   '🔓 Allow Registrations (true/false)',
  };

  return (
    <AdminLayout title="Settings">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Platform Settings */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="font-bold text-white">Platform Settings</h2>
            <p className="text-xs text-gray-500 mt-0.5">Click any row to edit</p>
          </div>
          {loading ? <div className="p-5 space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-gray-800 rounded-xl animate-pulse" />)}</div> : (
            <div className="divide-y divide-gray-800">
              {settings.map((s) => (
                <div key={s.key} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-gray-800/30 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-200 font-medium">{FRIENDLY_LABELS[s.key] || s.key}</p>
                    {editKey === s.key ? (
                      <div className="flex items-center gap-2 mt-1.5">
                        <input type="text"
                          className="bg-gray-800 border border-indigo-500 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          autoFocus
                        />
                        <button onClick={() => saveSettings(s.key, editValue)} className="text-xs bg-green-600 text-white px-2.5 py-1.5 rounded-lg">Save</button>
                        <button onClick={() => setEditKey(null)} className="text-xs text-gray-400 hover:text-gray-200">Cancel</button>
                      </div>
                    ) : null}
                  </div>
                  <button onClick={() => { setEditKey(s.key); setEditValue(s.value); }}
                    className={`shrink-0 text-sm font-semibold px-3 py-1 rounded-lg transition-colors ${editKey === s.key ? 'bg-indigo-900/40 text-indigo-300' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
                    {s.value}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* USDT Wallet Addresses */}
        <div className="space-y-6">
          <div className="bg-gray-900 rounded-2xl border border-gray-800">
            <div className="px-5 py-4 border-b border-gray-800">
              <h2 className="font-bold text-white">USDT Wallet Addresses</h2>
              <p className="text-xs text-gray-500 mt-0.5">Users will send USDT to these addresses</p>
            </div>
            <form onSubmit={saveAddress} className="p-5 space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Network</label>
                <select className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none"
                  value={addrForm.chain_type} onChange={(e) => setAddrForm({ ...addrForm, chain_type: e.target.value })}>
                  <option value="TRC20">TRC20 (TRON)</option>
                  <option value="BEP20">BEP20 (BNB Chain)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Wallet Address</label>
                <input type="text" required
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-indigo-500"
                  placeholder="Paste wallet address..."
                  value={addrForm.address} onChange={(e) => setAddrForm({ ...addrForm, address: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Label (optional)</label>
                <input type="text"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. Main TRC20 Wallet"
                  value={addrForm.label} onChange={(e) => setAddrForm({ ...addrForm, label: e.target.value })} />
              </div>
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
                Update Address
              </button>
            </form>
          </div>

          {/* Bank Accounts */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <div>
                <h2 className="font-bold text-white">Bank Accounts</h2>
                <p className="text-xs text-gray-500 mt-0.5">For INR deposits</p>
              </div>
              <button onClick={() => setShowBankForm(!showBankForm)}
                className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors">
                + Add Bank
              </button>
            </div>

            {showBankForm && (
              <form onSubmit={saveBank} className="p-5 border-b border-gray-800 space-y-3">
                {[
                  { key: 'bank_name',       label: 'Bank Name',       placeholder: 'e.g. HDFC Bank' },
                  { key: 'account_holder',  label: 'Account Holder',  placeholder: 'Full name' },
                  { key: 'account_number',  label: 'Account Number',  placeholder: '' },
                  { key: 'ifsc_code',       label: 'IFSC Code',       placeholder: 'e.g. HDFC0001234' },
                  { key: 'upi_id',          label: 'UPI ID',          placeholder: 'optional' },
                  { key: 'daily_limit',     label: 'Daily Limit (₹)', placeholder: '100000' },
                  { key: 'whatsapp_number', label: 'WhatsApp (when full)', placeholder: '+91XXXXXXXXXX' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="block text-xs text-gray-400 mb-1">{label}</label>
                    <input type="text"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                      placeholder={placeholder}
                      value={bankForm[key]} onChange={(e) => setBankForm({ ...bankForm, [key]: e.target.value })} />
                  </div>
                ))}
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-green-600 hover:bg-green-500 text-white font-medium py-2 rounded-xl text-sm">Save Bank</button>
                  <button type="button" onClick={() => setShowBankForm(false)} className="flex-1 bg-gray-800 text-gray-300 py-2 rounded-xl text-sm">Cancel</button>
                </div>
              </form>
            )}

            <div className="divide-y divide-gray-800">
              {banks.length === 0 && <p className="text-center text-gray-500 text-sm py-6">No bank accounts added</p>}
              {banks.map((b) => (
                <div key={b.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white text-sm">{b.bank_name}</p>
                    <p className="text-xs text-gray-400">{b.account_number} · {b.ifsc_code}</p>
                    <div className="flex gap-3 mt-1">
                      <span className="text-xs text-gray-500">Limit: ₹{parseFloat(b.daily_limit).toLocaleString('en-IN')}</span>
                      <span className="text-xs text-gray-500">Used: ₹{parseFloat(b.current_daily_total).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${b.is_active ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                    {b.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
