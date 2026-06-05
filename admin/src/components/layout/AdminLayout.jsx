// admin/src/components/layout/AdminLayout.jsx
import { Link, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';

const NAV = [
  { path: '/',            icon: '📊', label: 'Dashboard'     },
  { path: '/assign',      icon: '🔄', label: 'Assign Orders'  },
  { path: '/deposits',    icon: '⬇️',  label: 'Deposits'      },
  { path: '/withdrawals', icon: '⬆️',  label: 'Withdrawals'   },
  { path: '/investments', icon: '📈', label: 'Investments'   },
  { path: '/users',       icon: '👥', label: 'Users'         },
  { path: '/broadcasts',  icon: '📢', label: 'Broadcasts'    },
  { path: '/settings',    icon: '⚙️',  label: 'Settings'      },
  { path: '/logs',        icon: '📋', label: 'Audit Logs'   },
];

export default function AdminLayout({ children, title }) {
  const { pathname } = useLocation();
  const { admin, logout } = useAdminAuth();

  return (
    <div className="flex min-h-screen bg-gray-950">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0 fixed top-0 bottom-0 left-0 z-30">
        {/* Logo */}
        <div className="p-5 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-lg shadow-indigo-900/40">
              VP
            </div>
            <div>
              <p className="font-black text-white text-sm">VaultPay</p>
              <p className="text-xs text-indigo-400">Admin Panel</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ path, icon, label }) => {
            const active = path==='/' ? pathname==='/' : pathname.startsWith(path);
            return (
              <Link key={path} to={path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                  active
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/30'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}>
                <span className="text-base">{icon}</span>
                <span className="font-medium">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-xs shadow">
              {admin?.full_name?.charAt(0) || 'A'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{admin?.full_name}</p>
              <p className="text-xs text-indigo-400 capitalize">{admin?.role}</p>
            </div>
          </div>
          <button onClick={logout}
            className="w-full text-xs text-gray-600 hover:text-red-400 transition-colors text-left py-1 hover:bg-red-900/10 rounded-lg px-2">
            ⏻ Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 ml-56 min-w-0">
        {title && (
          <div className="sticky top-0 z-20 border-b border-gray-800 bg-gray-950/90 backdrop-blur-xl px-8 py-4">
            <h1 className="text-xl font-black text-white">{title}</h1>
          </div>
        )}
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
