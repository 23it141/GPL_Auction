import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider, useSocket } from './context/SocketContext';
import PortalEntry from './pages/PortalEntry';
import AdminLogin from './pages/AdminLogin';
import CaptainLogin from './pages/captain/CaptainLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import CaptainDashboard from './pages/captain/CaptainDashboard';
import PublicDashboard from './pages/PublicDashboard';
import { X, Sparkles } from 'lucide-react';

// Toast Notification overlay container
const ToastContainer: React.FC = () => {
  const { notifications, removeToast } = useSocket();

  return (
    <div className="fixed bottom-5 right-5 z-50 space-y-3 max-w-sm w-full pointer-events-none">
      {notifications.map((toast) => {
        const typeStyles = {
          success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
          warning: 'bg-amber-50 border-amber-200 text-amber-900',
          error: 'bg-rose-50 border-rose-200 text-rose-900',
          info: 'bg-blue-50 border-blue-200 text-blue-900',
        };

        const style = typeStyles[toast.type] || typeStyles.info;

        return (
          <div
            key={toast.id}
            className={`p-4 rounded-2xl border shadow-xl pointer-events-auto flex items-start justify-between gap-3 animate-slide-in ${style}`}
          >
            <div className="flex gap-2">
              <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-xs font-bold leading-relaxed">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 p-0.5 hover:bg-slate-100/50 rounded-lg cursor-pointer shrink-0 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

// Routes that need auth + socket
const AuthenticatedRoutes: React.FC = () => {
  return (
    <SocketProvider>
      <Routes>
        <Route path="/" element={<PortalEntry />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/captain/login" element={<CaptainLogin />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/captain" element={<CaptainDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer />
    </SocketProvider>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public viewer — no auth, no socket provider needed */}
        <Route path="/public" element={<PublicDashboard />} />

        {/* All other routes — wrap with AuthProvider + SocketProvider */}
        <Route
          path="/*"
          element={
            <AuthProvider>
              <AuthenticatedRoutes />
            </AuthProvider>
          }
        />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
