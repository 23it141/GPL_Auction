import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, User, AlertCircle } from 'lucide-react';

const AdminLogin: React.FC = () => {
  const { loginAdmin, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If already authenticated, go to the right dashboard
  useEffect(() => {
    if (authLoading) return;
    if (user?.role === 'admin') navigate('/admin', { replace: true });
    if (user?.role === 'captain') navigate('/captain', { replace: true });
  }, [authLoading, user?.role, navigate]);

  // Show spinner while checking session
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-tr from-slate-900 via-slate-800 to-slate-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-400">Checking session...</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Username and password are required');
      return;
    }

    try {
      setError('');
      setLoading(true);
      await loginAdmin(username, password);
      navigate('/admin');
    } catch (err: any) {
      setError(err.message || 'Invalid administrator credentials');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-tr from-slate-900 via-slate-800 to-slate-950 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(37,99,235,0.08),transparent_50%)] pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-brand-blue/10 rounded-2xl border border-brand-blue/20 text-brand-blue mb-2">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight font-sans">
            Auctioneer Portal
          </h1>
          <p className="text-slate-400 text-sm font-medium">
            Authorized administrator authentication
          </p>
        </div>

        <div className="glass-card rounded-3xl border border-slate-700/50 p-8 shadow-2xl bg-slate-900/60 backdrop-blur-xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-4 py-3 bg-slate-950/40 border border-slate-700/50 rounded-xl text-white text-sm focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue placeholder:text-slate-600 transition-all"
                  placeholder="admin"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-4 py-3 bg-slate-950/40 border border-slate-700/50 rounded-xl text-white text-sm focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue placeholder:text-slate-600 transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-brand-blue hover:bg-brand-blue-dark disabled:bg-brand-blue/50 text-white font-bold rounded-xl text-sm shadow-lg shadow-brand-blue/20 hover:shadow-brand-blue/30 transition-all cursor-pointer mt-2"
            >
              {loading ? 'Authenticating...' : 'Sign In as Auctioneer'}
            </button>
          </form>
        </div>

        <div className="text-center">
          <button
            onClick={() => navigate('/captain/login')}
            className="text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            Switch to Team Captain Log In &rarr;
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
