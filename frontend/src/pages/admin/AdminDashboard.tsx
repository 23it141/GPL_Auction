import React, { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import StatCard from '../../components/StatCard';
import TeamManagement from './TeamManagement';
import PlayerManagement from './PlayerManagement';
import AuctionControl from './AuctionControl';
import ReportsPage from './ReportsPage';
import TeamRosterPage from './TeamRosterPage';
import QRCode from 'qrcode';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Users, UserCheck, RefreshCw, Landmark, Activity, QrCode, ExternalLink, Eye, Gavel } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const formatPrice = (amount: number): string => {
  return `${amount.toLocaleString()} pts`;
};

const COLORS = ['#2563EB', '#10B981', '#F97316', '#8B5CF6', '#06B6D4', '#EC4899', '#F59E0B', '#3B82F6'];

const AdminDashboard: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { auctionState, resetAuction, addToast } = useSocket();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [autoOpenAddPlayer, setAutoOpenAddPlayer] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Stats States
  const [summary, setSummary] = useState<any>({});
  const [chartData, setChartData] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);

  // Public & Admin QR Codes
  const [publicQrUrl, setPublicQrUrl] = useState('');
  const [publicViewerUrl, setPublicViewerUrl] = useState('');
  const [adminQrUrl, setAdminQrUrl] = useState('');
  const [adminViewerUrl, setAdminViewerUrl] = useState('');

  // Redirect if not authenticated as admin — wait for auth to finish loading first
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/admin/login');
    } else if (user.role !== 'admin') {
      navigate('/captain');
    }
  }, [authLoading, user?.role, navigate]);

  // Generate public viewer & admin console QR codes on mount
  useEffect(() => {
    const generateQrs = async () => {
      try {
        // Fetch the real LAN IP for mobile QR code
        const ipRes = await fetch('/api/auth/host-ip');
        let host = window.location.hostname;
        if ((host === 'localhost' || host === '127.0.0.1') && ipRes.ok) {
          const { ip } = await ipRes.json();
          if (ip && ip !== 'localhost') host = ip;
        }
        const port = window.location.port ? `:${window.location.port}` : '';
        
        // Public Spectator View
        const pubUrl = `${window.location.protocol}//${host}${port}/public`;
        setPublicViewerUrl(pubUrl);
        const pQr = await QRCode.toDataURL(pubUrl, {
          width: 220,
          margin: 2,
          color: { dark: '#1e293b', light: '#ffffff' },
        });
        setPublicQrUrl(pQr);

        // Admin Console View
        const admUrl = `${window.location.protocol}//${host}${port}/admin`;
        setAdminViewerUrl(admUrl);
        const aQr = await QRCode.toDataURL(admUrl, {
          width: 220,
          margin: 2,
          color: { dark: '#1e293b', light: '#ffffff' },
        });
        setAdminQrUrl(aQr);
      } catch (e) {
        console.error('Failed to generate QR codes:', e);
      }
    };
    generateQrs();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoadingStats(true);
      const token = localStorage.getItem('gpl_auth_token');
      
      // Fetch summary stats
      const summaryRes = await fetch('/api/reports/summary', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (summaryRes.ok) {
        const summaryJson = await summaryRes.json();
        setSummary(summaryJson);
      }

      // Fetch team spending stats
      const spendingRes = await fetch('/api/reports/spending', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (spendingRes.ok) {
        const spendingJson = await spendingRes.json();
        setChartData(spendingJson);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchDashboardStats();
    }
  }, [activeTab, auctionState?.auctionStatus]);

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar onMenuClick={() => setMobileSidebarOpen(true)} />

      <div className="flex flex-1 relative">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onAddPlayerClick={() => {
            setActiveTab('players');
            setAutoOpenAddPlayer(true);
          }}
          mobileOpen={mobileSidebarOpen}
          setMobileOpen={setMobileSidebarOpen}
        />

        <main className="flex-1 p-4 md:p-8 space-y-6 overflow-y-auto max-h-[calc(100vh-4rem)]">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Heading */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">
                    Auction Command Center
                  </h1>
                  <p className="text-slate-500 text-xs font-semibold">
                    Real-time monitoring of team spending, purse capacities, and bidding progress.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (window.confirm('⚠️ WARNING: This will reset all current player purchases, team remaining purses, active bids, and timers back to zero. Player catalog specifications and franchise configurations will NOT be changed. Are you sure you want to reset the bidding system?')) {
                        resetAuction();
                        addToast('warning', 'Bidding session has been reset.');
                        setTimeout(() => {
                          fetchDashboardStats();
                        }, 500); // Wait for DB write to propagate
                      }
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 bg-rose-50 border border-rose-200 hover:bg-rose-100/70 text-rose-600 font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
                    title="Reset Bidding Progress"
                  >
                    Reset Bidding
                  </button>
                  <button
                    onClick={fetchDashboardStats}
                    className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl cursor-pointer"
                    title="Refresh Statistics"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Stats Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Total Teams"
                  value={summary.totalTeams ?? 0}
                  icon={Users}
                  color="blue"
                />
                <StatCard
                  title="Sold Players"
                  value={`${summary.soldPlayers ?? 0} / ${summary.totalPlayers ?? 0}`}
                  icon={UserCheck}
                  color="green"
                  subtitle={`${summary.unsoldPlayers ?? 0} Unsold, ${(summary.totalPlayers ?? 0) - (summary.soldPlayers ?? 0) - (summary.unsoldPlayers ?? 0)} Waiting`}
                />
                <StatCard
                  title="Total Value Spent"
                  value={formatPrice(summary.totalSpentValue ?? 0)}
                  icon={Landmark}
                  color="orange"
                  subtitle={`Total Purse: ${formatPrice(summary.totalInitialPurse ?? 0)}`}
                />
                <StatCard
                  title="Total Bids Placed"
                  value={summary.totalBidsCount ?? 0}
                  icon={Activity}
                  color="purple"
                  subtitle="Live socket events"
                />
              </div>

              {/* QR Code Panels Grid */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Public Viewer QR Card */}
                <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 rounded-3xl border border-slate-700 shadow-premium p-6">
                  <div className="flex flex-col md:flex-row items-center gap-5">
                    {/* QR Code */}
                    <div className="shrink-0 p-3 bg-white rounded-2xl shadow-inner">
                      {publicQrUrl ? (
                        <img src={publicQrUrl} alt="Public Viewer QR" className="w-32 h-32 object-contain" />
                      ) : (
                        <div className="w-32 h-32 bg-slate-100 rounded-xl flex items-center justify-center">
                          <QrCode className="w-10 h-10 text-slate-300 animate-pulse" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 text-center md:text-left space-y-2.5">
                      <div className="flex items-center gap-2 justify-center md:justify-start">
                        <div className="w-7 h-7 rounded-xl bg-brand-blue/20 border border-brand-blue/30 flex items-center justify-center">
                          <Eye className="w-4 h-4 text-brand-blue" />
                        </div>
                        <div>
                          <h3 className="text-sm font-extrabold text-white">Public Spectator View</h3>
                          <p className="text-[9px] text-slate-400 font-semibold">Live spectator ring · Read-only</p>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-400 font-semibold leading-relaxed max-w-sm">
                        Audience scans it to watch live bidding on their phones. <span className="text-white font-bold">No login required</span>.
                      </p>

                      <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                        <div className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-xl max-w-xs overflow-hidden">
                          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">URL</p>
                          <p className="text-[10px] font-mono font-bold text-slate-300 truncate">{publicViewerUrl || 'Generating...'}</p>
                        </div>
                        {publicViewerUrl && (
                          <a
                            href={publicViewerUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-brand-blue hover:bg-brand-blue-dark text-white text-[10px] font-bold rounded-xl shadow-premium transition-all cursor-pointer"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Open View
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Admin Console QR Card */}
                <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 rounded-3xl border border-slate-700 shadow-premium p-6">
                  <div className="flex flex-col md:flex-row items-center gap-5">
                    {/* QR Code */}
                    <div className="shrink-0 p-3 bg-white rounded-2xl shadow-inner">
                      {adminQrUrl ? (
                        <img src={adminQrUrl} alt="Admin Console QR" className="w-32 h-32 object-contain" />
                      ) : (
                        <div className="w-32 h-32 bg-slate-100 rounded-xl flex items-center justify-center">
                          <QrCode className="w-10 h-10 text-slate-300 animate-pulse" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 text-center md:text-left space-y-2.5">
                      <div className="flex items-center gap-2 justify-center md:justify-start">
                        <div className="w-7 h-7 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center">
                          <Gavel className="w-4 h-4 text-rose-400" />
                        </div>
                        <div>
                          <h3 className="text-sm font-extrabold text-white">Admin Remote Console</h3>
                          <p className="text-[9px] text-rose-400 font-semibold">Multi-device control permitted</p>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-400 font-semibold leading-relaxed max-w-sm">
                        Scan to control the auction from your mobile phone or tablet. <span className="text-white font-bold">Admin credentials needed</span>.
                      </p>

                      <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                        <div className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-xl max-w-xs overflow-hidden">
                          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">URL</p>
                          <p className="text-[10px] font-mono font-bold text-slate-300 truncate">{adminViewerUrl || 'Generating...'}</p>
                        </div>
                        {adminViewerUrl && (
                          <a
                            href={adminViewerUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-bold rounded-xl shadow-premium transition-all cursor-pointer"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Open Console
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Player Live Tracker */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-premium space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${auctionState?.auctionStatus === 'active' ? 'bg-brand-green live-pulse' : auctionState?.auctionStatus === 'paused' ? 'bg-amber-400' : 'bg-slate-300'}`} />
                    Live Bidding Ring Status
                  </h3>
                  <span className="text-xs font-bold text-slate-500 uppercase">
                    Status: <span className="font-extrabold text-brand-blue">{auctionState?.auctionStatus.toUpperCase() || 'IDLE'}</span>
                  </span>
                </div>

                {auctionState?.currentPlayerId ? (
                  <div className="flex flex-col md:flex-row items-center gap-6 p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50">
                    <div className="w-20 h-20 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                      {auctionState.currentPlayerId.photo ? (
                        <img src={auctionState.currentPlayerId.photo} alt={auctionState.currentPlayerId.playerName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-black text-slate-400 uppercase">{auctionState.currentPlayerId.playerName.slice(0, 2)}</span>
                      )}
                    </div>
                    <div className="flex-1 text-center md:text-left space-y-1">
                      <h4 className="text-lg font-extrabold text-slate-800">{auctionState.currentPlayerId.playerName}</h4>
                      <p className="text-xs text-slate-500 font-semibold uppercase">
                        {auctionState.currentPlayerId.role} &bull; {auctionState.currentPlayerId.category} &bull; Age {auctionState.currentPlayerId.age}
                      </p>
                      <p className="text-xs text-slate-400 font-semibold">{auctionState.currentPlayerId.description}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-center md:text-right shrink-0 border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-6">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current Bid</p>
                        <p className="text-lg font-black text-brand-blue">{auctionState.currentBid > 0 ? formatPrice(auctionState.currentBid) : 'Base ' + formatPrice(auctionState.currentPlayerId.basePrice)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Highest Bidder</p>
                        <p className="text-sm font-bold text-slate-700">{auctionState.highestBidderId?.teamName || 'No Bids'}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center text-slate-400 text-xs font-semibold">
                    No active player in the ring. Navigate to the "Live Auction" tab to begin.
                  </div>
                )}
              </div>

              {/* Charts & Visualization Block */}
              {loadingStats ? (
                <div className="h-64 bg-white rounded-3xl border border-slate-200 shadow-premium flex items-center justify-center text-slate-400 font-semibold">
                  <RefreshCw className="w-6 h-6 animate-spin text-brand-blue mr-2" />
                  Updating visualization charts...
                </div>
              ) : chartData.length === 0 ? (
                <div className="p-12 bg-white border border-slate-200 rounded-3xl text-center text-slate-400 font-semibold">
                  No chart metrics. Please add teams to render charts.
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Spend by Team BarChart */}
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-premium space-y-4">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                        Purse Spend Analysis
                      </h3>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                        Amount spent in Crore Rupees by each franchise
                      </p>
                    </div>
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="teamCode" tickLine={false} />
                          <YAxis tickLine={false} tickFormatter={(val) => `${(val / 10000000).toFixed(0)} Cr`} />
                          <Tooltip
                            formatter={(value: any) => [formatPrice(value), 'Spent']}
                            cursor={{ fill: '#f8fafc' }}
                          />
                          <Bar dataKey="spentAmount" fill="#2563EB" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Purse Remaining PieChart */}
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-premium space-y-4">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                        Purse Capacity Shares
                      </h3>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                        Proportionate remaining budget distribution
                      </p>
                    </div>
                    <div className="h-72 w-full flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartData}
                            dataKey="remainingPurse"
                            nameKey="teamName"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            fill="#8884d8"
                            label={(entry: any) => entry.teamCode}
                          >
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: any) => formatPrice(value)} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'teams' && <TeamManagement />}
          {activeTab === 'players' && (
            <PlayerManagement
              autoOpenAdd={autoOpenAddPlayer}
              onAddOpened={() => setAutoOpenAddPlayer(false)}
            />
          )}
          {activeTab === 'control' && <AuctionControl />}
          {activeTab === 'roster' && <TeamRosterPage />}
          {activeTab === 'reports' && <ReportsPage />}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
