// admin/src/pages/LogsPage.jsx
import { useState, useEffect } from 'react';
import { api } from '../context/AdminAuthContext';
import AdminLayout from '../components/layout/AdminLayout';

const ACTION_COLOR = {
  APPROVE_DEPOSIT:   'text-green-400 bg-green-900/30',
  REJECT_DEPOSIT:    'text-red-400 bg-red-900/30',
  FREEZE_USER:       'text-red-400 bg-red-900/30',
  UNFREEZE_USER:     'text-green-400 bg-green-900/30',
  ADJUST_WALLET:     'text-yellow-400 bg-yellow-900/30',
  UPDATE_SETTING:    'text-blue-400 bg-blue-900/30',
  UPDATE_USDT_ADDRESS: 'text-purple-400 bg-purple-900/30',
};

export default function LogsPage() {
  const [logs, setLogs]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [page, setPage]     = useState(1);

  useEffect(() => {
    setLoading(true);
    api.get('/admin/logs', { params: { page, limit: 30 } })
      .then(({ data }) => setLogs(data.data))
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <AdminLayout title="Audit Logs">
      <p className="text-sm text-gray-400 mb-5">Every admin action is recorded here for security and accountability.</p>

      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
              <th className="text-left px-5 py-3">Action</th>
              <th className="text-left px-4 py-3">Admin</th>
              <th className="text-left px-4 py-3">Target</th>
              <th className="text-left px-4 py-3">Note</th>
              <th className="text-left px-4 py-3">IP</th>
              <th className="text-left px-4 py-3">Time</th>
              <th className="text-right px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(8)].map((_, i) => (
                <tr key={i} className="border-b border-gray-800/50">
                  <td colSpan={7} className="px-5 py-4"><div className="h-4 bg-gray-800 rounded animate-pulse w-3/4" /></td>
                </tr>
              ))
            ) : logs.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-500">No logs yet</td></tr>
            ) : logs.map((log) => (
              <tr key={log.id} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                <td className="px-5 py-3">
                  <span className={`text-xs font-medium px-2 py-1 rounded-lg ${ACTION_COLOR[log.action] || 'text-gray-400 bg-gray-800'}`}>
                    {log.action.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <p className="text-gray-200 text-sm">{log.admin_name}</p>
                  <p className="text-gray-500 text-xs">{log.admin_phone}</p>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">{log.target_type || '—'}</td>
                <td className="px-4 py-3 text-xs text-gray-400 max-w-xs truncate">{log.note || '—'}</td>
                <td className="px-4 py-3 text-xs font-mono text-gray-500">{log.ip_address || '—'}</td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {new Date(log.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-4 py-3 text-right">
                  {(log.before_value || log.after_value) && (
                    <button onClick={() => setSelected(log)} className="text-xs text-indigo-400 hover:text-indigo-300">View diff</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex gap-3 mt-5 justify-center">
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
          className="px-4 py-2 bg-gray-900 border border-gray-700 rounded-xl text-sm text-gray-400 hover:bg-gray-800 disabled:opacity-30">
          ← Previous
        </button>
        <span className="px-4 py-2 text-sm text-gray-500">Page {page}</span>
        <button onClick={() => setPage(p => p + 1)} disabled={logs.length < 30}
          className="px-4 py-2 bg-gray-900 border border-gray-700 rounded-xl text-sm text-gray-400 hover:bg-gray-800 disabled:opacity-30">
          Next →
        </button>
      </div>

      {/* Diff Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-gray-900 rounded-2xl w-full max-w-lg border border-gray-700 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-white">Change Details</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Before</p>
                <pre className="bg-gray-800 rounded-xl p-3 text-xs text-red-300 overflow-auto max-h-48">
                  {JSON.stringify(selected.before_value, null, 2) || '—'}
                </pre>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">After</p>
                <pre className="bg-gray-800 rounded-xl p-3 text-xs text-green-300 overflow-auto max-h-48">
                  {JSON.stringify(selected.after_value, null, 2) || '—'}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
