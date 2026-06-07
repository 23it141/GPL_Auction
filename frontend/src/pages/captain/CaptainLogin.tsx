import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Users, Lock, Key, AlertCircle, LogOut } from 'lucide-react';

const CaptainLogin: React.FC = () => {
  const { loginCaptain, logout, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [teamCode, setTeamCode] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionMismatch, setSessionMismatch] = useState(false);

  // Read the ?code= param from URL (set by QR code)
  const codeParam = searchParams.get('code')?.toUpperCase() || '';

  // Run once auth loading is done — decide what to do with the existing session
  const handled = useRef(false);
  useEffect(() => {
    if (authLoading) return;
    if (handled.current) return;
    handled.current = true;

    if (user?.role === 'admin') {
      // Admin scanning a captain QR — just navigate to admin
      navigate('/admin', { replace: true });
      return;
    }

    if (user?.role === 'captain') {
      if (codeParam && user.teamCode?.toUpperCase() !== codeParam) {
        // ── MISMATCH: cached session is a DIFFERENT team than the QR code ──
        // This is the core iOS bug: phone A scans phone B's QR
        // Solution: clear old session so this captain can log in fresh
        setSessionMismatch(true);
        logout(); // wipe old token + user from memory + localStorage
        setTeamCode(codeParam);
        return;
      }
      // Same team OR no code param → go straight to dashboard
      navigate('/captain', { replace: true });
      return;
    }

    // Not logged in → pre-fill team code from URL if available
    if (codeParam) {
      setTeamCode(codeParam);
    }
  }, [authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // While checking session, show spinner — never flash wrong content
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-400">Checking session...</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamCode || !pin) {
      setError('Team Code and 4-Digit PIN are required');
      return;
    }
    try {
      setError('');
      setLoading(true);
      await loginCaptain(teamCode, pin);
      navigate('/captain', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Invalid Team Code or PIN. Please check with the Admin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 relative">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3.5 bg-brand-blue/10 rounded-2xl text-brand-blue border border-brand-blue/20 mb-1">
            <Users className="w-7 h-7" />
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight font-sans">
            Captain Dashboard
          </h1>
          <p className="text-slate-500 text-sm font-semibold">
            {codeParam
              ? `Logging in as team: ${codeParam}`
              : 'Enter your Team Code and PIN'}
          </p>
        </div>

        {/* Session mismatch notice */}
        {sessionMismatch && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold rounded-2xl flex items-center gap-2">
            <LogOut className="w-4 h-4 shrink-0 text-amber-500" />
            Previous session cleared. Please enter PIN for <span className="font-black ml-1">{codeParam}</span>.
          </div>
        )}

        {/* Login Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-premium">
          <form onSubmit={handleSubmit} className="space-y-5">

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Team Code */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Team Code
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Key className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={teamCode}
                  onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
                  className="block w-full pl-10 pr-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 text-sm font-bold focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue placeholder:text-slate-400 uppercase transition-all"
                  placeholder="e.g. TITANS"
                  required
                  autoCapitalize="characters"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>

            {/* PIN */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                4-Digit Login PIN
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  maxLength={4}
                  className="block w-full pl-10 pr-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 text-sm font-bold tracking-widest focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue placeholder:text-slate-400 transition-all"
                  placeholder="••••"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-brand-blue hover:bg-brand-blue-dark disabled:bg-brand-blue/50 text-white font-bold rounded-xl text-sm shadow-premium transition-all cursor-pointer mt-2 active:scale-95"
            >
              {loading ? 'Logging in...' : 'Access Bidding Console'}
            </button>
          </form>
        </div>

        <div className="text-center">
          <button
            onClick={() => navigate('/admin/login')}
            className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            Enter as Auctioneer &rarr;
          </button>
        </div>
      </div>
    </div>
  );
};

export default CaptainLogin;
