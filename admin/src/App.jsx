import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import LoginPage        from './pages/LoginPage';
import DashboardPage    from './pages/DashboardPage';
import AssignmentPage   from './pages/AssignmentPage';
import DepositsPage     from './pages/DepositsPage';
import WithdrawalsPage  from './pages/WithdrawalsPage';
import InvestmentsPage  from './pages/InvestmentsPage';
import UsersPage        from './pages/UsersPage';
import UserDetailPage   from './pages/UserDetailPage';
import BroadcastsPage   from './pages/BroadcastsPage';
import SettingsPage     from './pages/SettingsPage';
import LogsPage         from './pages/LogsPage';

const Spin = () => (
  <div className="min-h-screen bg-gray-950 flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
  </div>
);

const Protected = ({ children }) => {
  const { isAuthenticated, isLoading } = useAdminAuth();
  if (isLoading) return <Spin />;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

const P = ({ children }) => <Protected>{children}</Protected>;

const AppRoutes = () => (
  <Routes>
    <Route path="/login"       element={<LoginPage />} />
    <Route path="/"            element={<P><DashboardPage /></P>} />
    <Route path="/assign"      element={<P><AssignmentPage /></P>} />
    <Route path="/deposits"    element={<P><DepositsPage /></P>} />
    <Route path="/withdrawals" element={<P><WithdrawalsPage /></P>} />
    <Route path="/investments" element={<P><InvestmentsPage /></P>} />
    <Route path="/users"       element={<P><UsersPage /></P>} />
    <Route path="/users/:user_id" element={<P><UserDetailPage /></P>} />
    <Route path="/broadcasts"  element={<P><BroadcastsPage /></P>} />
    <Route path="/settings"    element={<P><SettingsPage /></P>} />
    <Route path="/logs"        element={<P><LogsPage /></P>} />
    <Route path="*"            element={<Navigate to="/" replace />} />
  </Routes>
);

export default function App() {
  return (
    <BrowserRouter>
      <AdminAuthProvider>
        <AppRoutes />
        <Toaster position="top-right"
          toastOptions={{ style: { background: '#111827', color: '#f9fafb', border: '1px solid #1f2937', borderRadius: '12px' } }} />
      </AdminAuthProvider>
    </BrowserRouter>
  );
}
