import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage           from './pages/LoginPage';
import RegisterPage        from './pages/RegisterPage';
import DashboardPage       from './pages/DashboardPage';
import DepositPage         from './pages/DepositPage';
import HistoryPage         from './pages/HistoryPage';
import WithdrawPage        from './pages/WithdrawPage';
import WithdrawHistoryPage from './pages/WithdrawHistoryPage';
import NotificationsPage   from './pages/NotificationsPage';
import InvestPage          from './pages/InvestPage';
import ReferralPage        from './pages/ReferralPage';

const Spinner = () => (
  <div className="min-h-screen bg-gray-950 flex items-center justify-center">
    <div className="w-12 h-12 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <Spinner />;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  return !isAuthenticated ? children : <Navigate to="/dashboard" replace />;
};

const P = ({ children }) => <ProtectedRoute>{children}</ProtectedRoute>;

const AppRoutes = () => (
  <Routes>
    <Route path="/"                 element={<Navigate to="/dashboard" replace />} />
    <Route path="/login"            element={<PublicRoute><LoginPage /></PublicRoute>} />
    <Route path="/register"         element={<PublicRoute><RegisterPage /></PublicRoute>} />
    <Route path="/dashboard"        element={<P><DashboardPage /></P>} />
    <Route path="/deposit"          element={<P><DepositPage /></P>} />
    <Route path="/history"          element={<P><HistoryPage /></P>} />
    <Route path="/withdraw"         element={<P><WithdrawPage /></P>} />
    <Route path="/withdraw/history" element={<P><WithdrawHistoryPage /></P>} />
    <Route path="/notifications"    element={<P><NotificationsPage /></P>} />
    <Route path="/invest"           element={<P><InvestPage /></P>} />
    <Route path="/referral"         element={<P><ReferralPage /></P>} />
    <Route path="*"                 element={<Navigate to="/dashboard" replace />} />
  </Routes>
);

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-center"
          toastOptions={{
            style: { background: '#111827', color: '#f9fafb', border: '1px solid #1f2937', borderRadius: '14px', fontSize: '14px' },
            success: { iconTheme: { primary: '#10b981', secondary: '#111827' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: '#111827' } },
            duration: 4000,
          }} />
      </AuthProvider>
    </BrowserRouter>
  );
}
