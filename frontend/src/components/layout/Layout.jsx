import { Link, useLocation } from 'react-router-dom';

const NAV = [
  { path: '/dashboard', icon: '🏠', label: 'Home'    },
  { path: '/deposit',   icon: '⬇️',  label: 'Deposit' },
  { path: '/invest',    icon: '📊',  label: 'Invest'  },
  { path: '/withdraw',  icon: '⬆️',  label: 'Withdraw'},
  { path: '/referral',  icon: '👥',  label: 'Referral'},
];

export default function Layout({ children }) {
  const { pathname } = useLocation();
  const isActive = (path) =>
    path === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(path);

  return (
    <div className="min-h-screen bg-gray-950" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}>
      <main>{children}</main>

      {/* Bottom navigation — mobile first, safe area aware */}
      <nav className="fixed bottom-0 left-0 right-0 z-40"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="absolute inset-0 bg-gray-950/95 backdrop-blur-xl border-t border-gray-800/50" />
        <div className="relative max-w-lg mx-auto flex items-center px-1 py-1">
          {NAV.map(({ path, icon, label }) => {
            const active = isActive(path);
            return (
              <Link key={path} to={path}
                className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 rounded-xl transition-all ${
                  active ? 'text-emerald-400' : 'text-gray-600 hover:text-gray-400'
                }`}>
                <span className={`text-xl leading-none transition-transform ${active ? 'scale-110' : 'scale-100'}`}>
                  {icon}
                </span>
                <span className={`text-xs font-bold ${active ? 'text-emerald-400' : 'text-gray-600'}`}>
                  {label}
                </span>
                {active && <span className="w-4 h-0.5 rounded-full bg-emerald-400" />}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
