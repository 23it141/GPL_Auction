import React from 'react';
import { LayoutDashboard, Users, UserRound, Gavel, BarChart3, Plus, Table2 } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onAddPlayerClick: () => void;
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onAddPlayerClick, mobileOpen, setMobileOpen }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'teams', label: 'Teams', icon: Users },
    { id: 'players', label: 'Players', icon: UserRound, hasSubAction: true },
    { id: 'control', label: 'Live Auction', icon: Gavel },
    { id: 'roster', label: 'Squad Table', icon: Table2 },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
  ];

  const renderContent = (isMobile = false) => (
    <>
      <nav className="flex-1 px-4 py-6 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <div key={item.id} className="space-y-1">
              <button
                onClick={() => {
                  setActiveTab(item.id);
                  if (isMobile && setMobileOpen) setMobileOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-brand-blue text-white shadow-premium shadow-brand-blue/10'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                {item.label}
              </button>
              {item.hasSubAction && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddPlayerClick();
                    if (isMobile && setMobileOpen) setMobileOpen(false);
                  }}
                  className="w-[calc(100%-1.75rem)] ml-7 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-brand-blue hover:bg-brand-blue/10 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add New Player
                </button>
              )}
            </div>
          );
        })}
      </nav>
      
      {/* Visual footer decoration */}
      <div className="p-6 border-t border-slate-100 text-center">
        <div className="px-3 py-2 bg-gradient-to-br from-brand-blue/5 to-brand-cyan/5 border border-brand-blue/10 rounded-xl">
          <p className="text-xs font-semibold text-brand-blue-dark">GPL Auction System</p>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">Enterprise Edition v1.0</p>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 glass-panel border-r border-slate-200 flex-col min-h-[calc(100vh-4rem)] shrink-0">
        {renderContent(false)}
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={() => setMobileOpen?.(false)}
          />
          {/* Drawer Panel */}
          <aside className="relative w-64 max-w-xs bg-white border-r border-slate-200 flex flex-col h-full shadow-2xl z-50 animate-slide-in-left">
            <div className="h-16 flex items-center px-6 border-b border-slate-150 shrink-0">
              <span className="text-sm font-bold bg-gradient-to-r from-brand-blue to-brand-cyan bg-clip-text text-transparent font-sans tracking-tight">
                🏏 GPL AUCTION MENU
              </span>
            </div>
            {renderContent(true)}
          </aside>
        </div>
      )}
    </>
  );
};

export default Sidebar;
