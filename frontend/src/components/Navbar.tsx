import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { LogOut, Wifi, WifiOff, Menu } from 'lucide-react';

interface NavbarProps {
  onMenuClick?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const { isConnected } = useSocket();

  if (!user) return null;

  return (
    <header className="h-16 glass-panel border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer mr-1"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <span className="text-xl font-bold bg-gradient-to-r from-brand-blue to-brand-cyan bg-clip-text text-transparent font-sans tracking-tight">
          🏏 GPL MEGA AUCTION
        </span>
        <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
          Season 2026
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* Connection status indicator */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-50 border border-slate-100">
          {isConnected ? (
            <>
              <Wifi className="w-4 h-4 text-brand-green live-pulse" />
              <span className="text-xs font-semibold text-brand-green-dark hidden md:inline">Connected</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 text-rose-500" />
              <span className="text-xs font-semibold text-rose-600 hidden md:inline">Disconnected</span>
            </>
          )}
        </div>

        {/* User profile and logout */}
        <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-slate-800">
              {user.role === 'admin' ? 'Administrator' : user.teamName}
            </p>
            <p className="text-xs text-slate-500 font-medium">
              {user.role === 'admin' ? 'Auctioneer' : `Captain: ${user.captainName}`}
            </p>
          </div>

          {user.logo && (
            <img
              src={user.logo}
              alt="Team logo"
              className="w-9 h-9 rounded-full object-cover border border-slate-200 bg-white"
            />
          )}

          <button
            onClick={logout}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
