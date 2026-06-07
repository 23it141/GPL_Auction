import React, { useEffect, useRef } from 'react';
import { SoldAnnouncement } from '../context/SocketContext';

interface Props {
  announcement: SoldAnnouncement;
  onDone: () => void;
}

const SoldAnnouncementOverlay: React.FC<Props> = ({ announcement, onDone }) => {
  const isSold = announcement.status === 'sold';
  const progressRef = useRef<HTMLDivElement>(null);

  // Animate the progress bar from 100% → 0% over 15s using CSS transition
  useEffect(() => {
    const el = progressRef.current;
    if (!el) return;
    // Start full, then immediately shrink
    el.style.width = '100%';
    const raf = requestAnimationFrame(() => {
      el.style.transition = 'width 15s linear';
      el.style.width = '0%';
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-hidden">
      {/* Dark blurred backdrop */}
      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md animate-fade-in" />

      {/* Radial spotlight glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: isSold
            ? 'radial-gradient(ellipse at center, rgba(16,185,129,0.18) 0%, transparent 70%)'
            : 'radial-gradient(ellipse at center, rgba(239,68,68,0.15) 0%, transparent 70%)',
        }}
      />

      {/* Animated floating particles */}
      {isSold && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full opacity-60"
              style={{
                background: ['#2563EB', '#10B981', '#F97316', '#8B5CF6', '#FBBF24'][i % 5],
                left: `${Math.random() * 100}%`,
                top: `${110 + Math.random() * 20}%`,
                animation: `floatUp ${2 + Math.random() * 4}s ease-in ${Math.random() * 3}s infinite`,
                transform: `scale(${0.5 + Math.random()})`,
              }}
            />
          ))}
        </div>
      )}

      {/* Main card */}
      <div
        className="relative z-10 w-full max-w-sm mx-auto animate-slide-in"
        style={{ animation: 'bounceIn 0.6s cubic-bezier(0.34,1.56,0.64,1) both' }}
      >
        {/* Status badge */}
        <div className="flex justify-center mb-4">
          <div
            className={`px-6 py-2 rounded-full text-xs font-black tracking-[0.2em] uppercase shadow-lg ${
              isSold
                ? 'bg-emerald-500 text-white shadow-emerald-500/40'
                : 'bg-rose-500 text-white shadow-rose-500/40'
            }`}
            style={{ letterSpacing: '0.25em' }}
          >
            {isSold ? '🏏 SOLD!' : '❌ UNSOLD'}
          </div>
        </div>

        {/* Card body */}
        <div
          className={`rounded-3xl border p-6 text-center space-y-5 shadow-2xl ${
            isSold
              ? 'bg-gradient-to-b from-slate-900 to-slate-950 border-emerald-500/30'
              : 'bg-gradient-to-b from-slate-900 to-slate-950 border-rose-500/30'
          }`}
        >
          {/* Player name */}
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-1">Player</p>
            <h2 className="text-2xl font-black text-white leading-tight tracking-tight">
              {announcement.playerName}
            </h2>
          </div>

          {isSold ? (
            <>
              {/* Sold to info */}
              <div className="flex flex-col items-center gap-3">
                <div className="w-px h-6 bg-slate-700" />
                <div className="flex items-center gap-3">
                  {announcement.logo ? (
                    <img
                      src={announcement.logo}
                      alt={announcement.teamName}
                      className="w-10 h-10 rounded-full border-2 border-emerald-500/50 bg-white object-cover shadow-lg"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center">
                      <span className="text-sm font-black text-emerald-400">{announcement.teamCode.slice(0, 2)}</span>
                    </div>
                  )}
                  <div className="text-left">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Purchased by</p>
                    <p className="text-base font-extrabold text-white">{announcement.teamName}</p>
                    <p className="text-[10px] font-bold text-slate-400 font-mono">{announcement.teamCode}</p>
                  </div>
                </div>

                {/* Price */}
                <div className="w-full py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest mb-0.5">Final Price</p>
                  <p className="text-3xl font-black text-emerald-400 tracking-tight">
                    {announcement.price.toLocaleString()} <span className="text-lg">pts</span>
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="py-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-rose-500/10 border-2 border-rose-500/30 flex items-center justify-center mb-3">
                <span className="text-2xl">🚫</span>
              </div>
              <p className="text-slate-400 text-sm font-semibold">
                No bids received. Player will be put back in the pool.
              </p>
            </div>
          )}

          {/* Countdown */}
          <div className="space-y-2">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              Next player in{' '}
              <span className={`font-black text-sm ${isSold ? 'text-emerald-400' : 'text-rose-400'}`}>
                {announcement.countdown}s
              </span>
            </p>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                ref={progressRef}
                className={`h-full rounded-full ${isSold ? 'bg-emerald-500' : 'bg-rose-500'}`}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Skip button */}
          <button
            onClick={onDone}
            className="text-[10px] text-slate-600 hover:text-slate-400 font-bold uppercase tracking-widest transition-colors cursor-pointer"
          >
            Skip →
          </button>
        </div>
      </div>

      <style>{`
        @keyframes floatUp {
          0% { transform: translateY(0) scale(1); opacity: 0.7; }
          100% { transform: translateY(-110vh) scale(0.5); opacity: 0; }
        }
        @keyframes bounceIn {
          0% { opacity: 0; transform: scale(0.3) translateY(40px); }
          60% { opacity: 1; transform: scale(1.05) translateY(-8px); }
          80% { transform: scale(0.97) translateY(4px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in { animation: fade-in 0.3s ease both; }
      `}</style>
    </div>
  );
};

export default SoldAnnouncementOverlay;
