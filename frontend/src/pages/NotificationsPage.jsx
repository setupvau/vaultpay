// src/pages/NotificationsPage.jsx
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { walletAPI } from '../services/api';
import Layout from '../components/layout/Layout';

const TYPE_STYLE = {
  success: { bg: 'bg-emerald-900/20 border-emerald-800/40', icon: '✅', dot: 'bg-emerald-400', title: 'text-emerald-300' },
  error:   { bg: 'bg-red-900/20 border-red-800/40',         icon: '❌', dot: 'bg-red-400',     title: 'text-red-300'     },
  warning: { bg: 'bg-amber-900/20 border-amber-800/40',     icon: '⚠️', dot: 'bg-amber-400',   title: 'text-amber-300'   },
  info:    { bg: 'bg-blue-900/20 border-blue-800/40',       icon: '🔔', dot: 'bg-blue-400',    title: 'text-blue-300'    },
};

const REF_LINKS = {
  deposit:    (id) => `/history`,
  withdrawal: (id) => `/withdraw/history`,
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [notifs, setNotifs]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    walletAPI.getNotifications()
      .then(r => setNotifs(r.data.data))
      .finally(() => setLoading(false));
  }, []);

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const handleClick = (n) => setSelected(n);

  const goToRef = (n) => {
    setSelected(null);
    const linkFn = REF_LINKS[n.reference_type];
    if (linkFn) navigate(linkFn(n.reference_id));
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
            <h1 className="text-xl font-black text-white">Notifications</h1>
            <p className="text-gray-500 text-xs">Tap any notification to view details</p>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-900 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : notifs.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">🔔</div>
            <p className="text-gray-400 font-semibold">No notifications yet</p>
            <p className="text-gray-600 text-sm mt-1">You'll be notified about deposits, withdrawals, and more</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifs.map((n) => {
              const style = TYPE_STYLE[n.type] || TYPE_STYLE.info;
              return (
                <button key={n.id} onClick={() => handleClick(n)}
                  className={`w-full text-left rounded-2xl border p-4 transition-all active:scale-[0.99] hover:brightness-110 ${style.bg} ${!n.is_read ? 'opacity-100' : 'opacity-70'}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center text-xl shrink-0">
                      {style.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className={`text-sm font-black truncate ${style.title}`}>{n.title}</p>
                        {!n.is_read && (
                          <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                        )}
                      </div>
                      <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">{n.body}</p>
                      <p className="text-xs text-gray-600 mt-1.5">{fmtDate(n.created_at)}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center p-4"
          onClick={() => setSelected(null)}>
          <div className="bg-gray-900 rounded-3xl w-full max-w-lg border border-gray-800 overflow-hidden"
            onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div className={`px-5 py-4 border-b border-gray-800 ${TYPE_STYLE[selected.type]?.bg || ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{TYPE_STYLE[selected.type]?.icon || '🔔'}</span>
                  <p className={`font-black text-sm ${TYPE_STYLE[selected.type]?.title || 'text-white'}`}>
                    {selected.title}
                  </p>
                </div>
                <button onClick={() => setSelected(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-black/30 text-gray-400 hover:text-white">
                  ✕
                </button>
              </div>
            </div>

            {/* Modal body */}
            <div className="p-5">
              <p className="text-gray-300 text-sm leading-relaxed">{selected.body}</p>
              <p className="text-gray-600 text-xs mt-3">
                {new Date(selected.created_at).toLocaleString('en-IN', {
                  weekday: 'short', day: '2-digit', month: 'long',
                  year: 'numeric', hour: '2-digit', minute: '2-digit'
                })}
              </p>

              {/* Action button if has reference */}
              {selected.reference_type && REF_LINKS[selected.reference_type] && (
                <button onClick={() => goToRef(selected)}
                  className="btn-primary w-full mt-5 py-3 text-sm">
                  View {selected.reference_type === 'deposit' ? 'Deposit History' : 'Withdrawal History'} →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
