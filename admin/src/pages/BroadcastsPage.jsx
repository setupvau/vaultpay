// admin/src/pages/BroadcastsPage.jsx
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { api } from '../context/AdminAuthContext';
import AdminLayout from '../components/layout/AdminLayout';

const TYPE_OPTS = [
  { value: 'info',    label: '📢 Info',    color: 'text-blue-400'   },
  { value: 'warning', label: '⚠️ Warning', color: 'text-amber-400'  },
  { value: 'success', label: '✅ Success', color: 'text-emerald-400' },
  { value: 'promo',   label: '🎉 Promo',   color: 'text-purple-400' },
];

export default function BroadcastsPage() {
  const [tab,         setTab]         = useState('broadcasts');
  const [broadcasts,  setBroadcasts]  = useState([]);
  const [notices,     setNotices]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [showNoticeForm, setShowNoticeForm] = useState(false);

  const [bcForm, setBcForm] = useState({ title: '', body: '', type: 'info', priority: 1, show_once: true, ends_at: '' });
  const [nForm,  setNForm]  = useState({ title: '', body: '', priority: 1 });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/admin/broadcasts'), api.get('/admin/notices')])
      .then(([b, n]) => { setBroadcasts(b.data.data); setNotices(n.data.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const saveBroadcast = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/admin/broadcasts', bcForm);
      toast.success('Broadcast created! Users will see it on next login.');
      setBcForm({ title: '', body: '', type: 'info', priority: 1, show_once: true, ends_at: '' });
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setSaving(false); }
  };

  const saveNotice = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/admin/notices', nForm);
      toast.success('Notice posted!');
      setNForm({ title: '', body: '', priority: 1 });
      setShowNoticeForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setSaving(false); }
  };

  const toggleBC = async (id) => {
    await api.patch(`/admin/broadcasts/${id}/toggle`);
    load();
  };

  const deleteBC = async (id) => {
    if (!confirm('Delete this broadcast?')) return;
    await api.delete(`/admin/broadcasts/${id}`);
    toast.success('Deleted');
    load();
  };

  const toggleNotice = async (id) => {
    await api.patch(`/admin/notices/${id}/toggle`);
    load();
  };

  const deleteNotice = async (id) => {
    if (!confirm('Delete this notice?')) return;
    await api.delete(`/admin/notices/${id}`);
    toast.success('Deleted');
    load();
  };

  return (
    <AdminLayout title="Broadcasts & Notices">
      <div className="flex gap-3 mb-6">
        {[{ id: 'broadcasts', label: '📢 Broadcasts (Popup)' }, { id: 'notices', label: '📌 Notices (Feed)' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${tab === t.id ? 'bg-indigo-600 text-white' : 'bg-gray-900 border border-gray-700 text-gray-400 hover:bg-gray-800'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* BROADCASTS */}
      {tab === 'broadcasts' && (
        <div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-gray-400 text-sm">Popup messages shown to users on login. They must dismiss before using the app.</p>
            </div>
            <button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm px-4 py-2">+ New Broadcast</button>
          </div>

          {showForm && (
            <form onSubmit={saveBroadcast} className="card rounded-2xl p-5 mb-5 border-indigo-800/30 bg-indigo-900/10 space-y-3">
              <h3 className="font-black text-white">Create Broadcast</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Title</label>
                  <input type="text" required className="input" placeholder="e.g. New Feature Alert!"
                    value={bcForm.title} onChange={e => setBcForm(p => ({ ...p, title: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Type</label>
                  <select className="input" value={bcForm.type} onChange={e => setBcForm(p => ({ ...p, type: e.target.value }))}>
                    {TYPE_OPTS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Message</label>
                <textarea required className="input resize-none" rows={3} placeholder="Your message to users..."
                  value={bcForm.body} onChange={e => setBcForm(p => ({ ...p, body: e.target.value }))} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Priority (1=low, 10=high)</label>
                  <input type="number" min="1" max="10" className="input"
                    value={bcForm.priority} onChange={e => setBcForm(p => ({ ...p, priority: parseInt(e.target.value) }))} />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Expires At (optional)</label>
                  <input type="datetime-local" className="input"
                    value={bcForm.ends_at} onChange={e => setBcForm(p => ({ ...p, ends_at: e.target.value }))} />
                </div>
                <div className="flex items-end pb-0.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={bcForm.show_once} onChange={e => setBcForm(p => ({ ...p, show_once: e.target.checked }))}
                      className="w-4 h-4 accent-indigo-500" />
                    <span className="text-sm text-gray-400">Show once only</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={saving} className="btn-primary text-sm px-5 py-2">
                  {saving ? 'Sending...' : 'Send Broadcast'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="bg-gray-800 text-gray-400 text-sm px-4 py-2 rounded-xl hover:bg-gray-700">Cancel</button>
              </div>
            </form>
          )}

          <div className="card rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                  <th className="text-left px-5 py-3">Title</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-center px-4 py-3">Reads</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Created</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(3)].map((_, i) => (
                    <tr key={i} className="border-b border-gray-800/50">
                      <td colSpan={6} className="px-5 py-4"><div className="h-4 bg-gray-800 rounded animate-pulse w-3/4" /></td>
                    </tr>
                  ))
                ) : broadcasts.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-500">No broadcasts yet</td></tr>
                ) : broadcasts.map(b => (
                  <tr key={b.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-white">{b.title}</p>
                      <p className="text-xs text-gray-500 truncate max-w-xs">{b.body}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 capitalize">{b.type}</td>
                    <td className="px-4 py-3 text-center text-gray-300">{b.read_count}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full ${b.is_active ? 'bg-emerald-900/40 text-emerald-400' : 'bg-gray-800 text-gray-500'}`}>
                        {b.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(b.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button onClick={() => toggleBC(b.id)} className="text-xs text-indigo-400 hover:text-indigo-300">
                        {b.is_active ? 'Disable' : 'Enable'}
                      </button>
                      <button onClick={() => deleteBC(b.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* NOTICES */}
      {tab === 'notices' && (
        <div>
          <div className="flex items-center justify-between mb-5">
            <p className="text-gray-400 text-sm">Persistent announcements shown in the user dashboard feed.</p>
            <button onClick={() => setShowNoticeForm(!showNoticeForm)} className="btn-primary text-sm px-4 py-2">+ New Notice</button>
          </div>

          {showNoticeForm && (
            <form onSubmit={saveNotice} className="card rounded-2xl p-5 mb-5 border-indigo-800/30 bg-indigo-900/10 space-y-3">
              <h3 className="font-black text-white">Post Notice</h3>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Title</label>
                <input type="text" required className="input" placeholder="Notice title"
                  value={nForm.title} onChange={e => setNForm(p => ({ ...p, title: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Message</label>
                <textarea required className="input resize-none" rows={3} placeholder="Notice content..."
                  value={nForm.body} onChange={e => setNForm(p => ({ ...p, body: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Priority (1=low, 10=high)</label>
                <input type="number" min="1" max="10" className="input w-24"
                  value={nForm.priority} onChange={e => setNForm(p => ({ ...p, priority: parseInt(e.target.value) }))} />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={saving} className="btn-primary text-sm px-5 py-2">
                  {saving ? 'Posting...' : 'Post Notice'}
                </button>
                <button type="button" onClick={() => setShowNoticeForm(false)} className="bg-gray-800 text-gray-400 text-sm px-4 py-2 rounded-xl hover:bg-gray-700">Cancel</button>
              </div>
            </form>
          )}

          <div className="space-y-3">
            {loading ? (
              [...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-900 rounded-2xl animate-pulse" />)
            ) : notices.length === 0 ? (
              <div className="card rounded-2xl p-8 text-center text-gray-500">No notices posted yet</div>
            ) : notices.map(n => (
              <div key={n.id} className={`card rounded-2xl p-4 ${n.is_active ? 'border-indigo-800/30 bg-indigo-900/10' : 'opacity-50'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 mr-4">
                    <p className="font-bold text-white">{n.title}</p>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">{n.body}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {new Date(n.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                      {' · '} Priority: {n.priority}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => toggleNotice(n.id)}
                      className={`text-xs px-3 py-1.5 rounded-lg ${n.is_active ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}>
                      {n.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button onClick={() => deleteNotice(n.id)} className="text-xs text-red-400 hover:text-red-300 px-2">✕</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
