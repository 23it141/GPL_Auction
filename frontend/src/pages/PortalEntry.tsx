import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Users, Gavel } from 'lucide-react';

const PortalEntry: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-tr from-slate-900 via-slate-800 to-slate-950 flex flex-col items-center justify-center p-6 relative">
      {/* Background radial highlight */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(37,99,235,0.06),transparent_60%)] pointer-events-none" />

      <div className="w-full max-w-4xl space-y-12 relative z-10 text-center">
        {/* Branding Title */}
        <div className="space-y-4">
          <div className="inline-flex p-4 bg-brand-blue/10 rounded-3xl text-brand-blue border border-brand-blue/20 shadow-glow mb-2 animate-bounce">
            <Gavel className="w-10 h-10" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight font-sans">
            🏏 GPL Cricket Mega Auction
          </h1>
          <p className="text-slate-400 text-sm sm:text-base max-w-md mx-auto font-medium leading-relaxed">
            Welcome to the live player draft portal. Please select your workspace below to access the real-time bidding floor.
          </p>
        </div>

        {/* Dashboards Portals Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {/* Captain Portal */}
          <button
            onClick={() => navigate('/captain/login')}
            className="group p-8 rounded-3xl bg-slate-900/40 border border-slate-800 hover:border-brand-cyan/50 text-left space-y-4 hover:shadow-glow hover:-translate-y-1 transition-all duration-300 backdrop-blur-xl cursor-pointer"
          >
            <div className="inline-flex p-3 bg-brand-cyan/10 group-hover:bg-brand-cyan/20 border border-brand-cyan/10 rounded-2xl text-brand-cyan transition-all">
              <Users className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-xl font-bold text-white group-hover:text-brand-cyan transition-colors">
                Captain Console
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed font-semibold">
                Mobile-optimized bidding panel for franchise representatives. Scan QR pass or input team PIN to enter the live ring.
              </p>
            </div>
            <div className="text-xs font-bold text-brand-cyan flex items-center gap-1 group-hover:translate-x-1.5 transition-transform pt-2">
              Join Bidding Floor &rarr;
            </div>
          </button>

          {/* Admin Portal */}
          <button
            onClick={() => navigate('/admin/login')}
            className="group p-8 rounded-3xl bg-slate-900/40 border border-slate-800 hover:border-brand-blue/50 text-left space-y-4 hover:shadow-glow hover:-translate-y-1 transition-all duration-300 backdrop-blur-xl cursor-pointer"
          >
            <div className="inline-flex p-3 bg-brand-blue/10 group-hover:bg-brand-blue/20 border border-brand-blue/10 rounded-2xl text-brand-blue transition-all">
              <Shield className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-xl font-bold text-white group-hover:text-brand-blue transition-colors">
                Auctioneer Desk
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed font-semibold">
                Core database administration, timer controls, draft tracking and squad validation reports.
              </p>
            </div>
            <div className="text-xs font-bold text-brand-blue flex items-center gap-1 group-hover:translate-x-1.5 transition-transform pt-2">
              Launch Control Desk &rarr;
            </div>
          </button>
        </div>

        {/* Footer */}
        <p className="text-[10px] text-slate-600 font-semibold uppercase tracking-widest pt-8">
          Powered by WebSockets &bull; Real-time latency &lt; 100ms &bull; GPL 2026
        </p>
      </div>
    </div>
  );
};

export default PortalEntry;
