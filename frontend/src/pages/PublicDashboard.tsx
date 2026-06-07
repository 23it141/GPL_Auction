import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Wifi, WifiOff, Users, Gavel, Trophy, Activity, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import SoldAnnouncementOverlay from '../components/SoldAnnouncementOverlay';

/* ─── Types ─────────────────────────────────────────────────────────── */
interface Player {
  _id: string;
  playerName: string;
  photo?: string;
  role: string;
  age: number;
  category: string;
  battingStyle?: string;
  bowlingStyle?: string;
  basePrice: number;
  soldStatus: string;
}

interface AuctionState {
  currentPlayerId: Player | null;
  currentBid: number;
  highestBidderId: { _id: string; teamName: string; teamCode: string; logo?: string } | null;
  auctionStatus: 'idle' | 'active' | 'paused' | 'completed';
  timerRemaining: number;
  bidHistory: Array<{ teamId: { teamName: string; teamCode: string }; bidAmount: number; timestamp: string }>;
}

interface TeamRoster {
  _id: string;
  teamName: string;
  teamCode: string;
  captainName: string;
  logo?: string;
  initialPurse: number;
  remainingPurse: number;
  players: Array<{ _id: string; playerName: string; role: string; soldPrice: number; photo?: string; category?: string }>;
}

const fmt = (n: number) => n.toLocaleString() + ' pts';

const ROLE_CHIP: Record<string, string> = {
  'Batsman': 'bg-sky-100 text-sky-700',
  'Bowler': 'bg-rose-100 text-rose-700',
  'All-Rounder': 'bg-violet-100 text-violet-700',
  'Wicket-Keeper': 'bg-amber-100 text-amber-700',
};

const CATEGORY_CHIP: Record<string, string> = {
  'A': 'bg-emerald-950/80 text-emerald-400 border-emerald-900/40',
  'B': 'bg-sky-950/80 text-sky-400 border-sky-900/40',
  'C': 'bg-amber-950/80 text-amber-400 border-amber-900/40',
  'D': 'bg-purple-950/80 text-purple-400 border-purple-900/40',
  'MARQUEE': 'bg-emerald-950/80 text-emerald-400 border-emerald-900/40',
  'CAPPED': 'bg-sky-950/80 text-sky-400 border-sky-900/40',
  'UNCAPPED': 'bg-amber-950/80 text-amber-400 border-amber-900/40',
};

const getCategoryLabel = (category?: string): string => {
  if (!category) return '';
  const cat = category.toUpperCase();
  if (cat === 'MARQUEE' || cat === 'A') return 'CAT A';
  if (cat === 'CAPPED' || cat === 'B') return 'CAT B';
  if (cat === 'UNCAPPED' || cat === 'C') return 'CAT C';
  if (cat === 'D') return 'CAT D';
  return cat;
};

const CATEGORY_ORDER: Record<string, number> = {
  'A': 1,
  'MARQUEE': 1,
  'B': 2,
  'CAPPED': 2,
  'C': 3,
  'UNCAPPED': 3,
  'D': 4,
};

const TEAM_GRAD = [
  'from-blue-600 to-blue-900',
  'from-emerald-600 to-emerald-900',
  'from-orange-500 to-orange-800',
  'from-purple-600 to-purple-900',
  'from-cyan-600 to-cyan-900',
];

/* ─── Component ─────────────────────────────────────────────────────── */
const PublicDashboard: React.FC = () => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null);
  const [timer, setTimer] = useState(15);
  const [bidFeed, setBidFeed] = useState<Array<{ teamName: string; teamCode: string; bidAmount: number; timestamp: string }>>([]);
  const [teams, setTeams] = useState<TeamRoster[]>([]);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [loadingToken, setLoadingToken] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [soldAnnouncement, setSoldAnnouncement] = useState<any | null>(null);

  // Clock tick
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch roster data
  const fetchRoster = useCallback(async (token: string) => {
    try {
      const host = window.location.hostname;
      const port = window.location.port;
      const protocol = window.location.protocol;

      let base;
      if (port === '5173' || port === '3000') {
        base = `${protocol}//${host}:5000`;
      } else {
        base = port ? `${protocol}//${host}:${port}` : `${protocol}//${host}`;
      }

      const [teamsRes] = await Promise.all([
        fetch(`${base}/api/teams`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (!teamsRes.ok) return;
      const teamsData = await teamsRes.json();

      const enriched = await Promise.all(
        teamsData.map(async (team: any) => {
          try {
            const sq = await fetch(`${base}/api/teams/${team._id}/squad`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const players = sq.ok ? await sq.json() : [];
            return {
              ...team,
              players: players.map((p: any) => ({
                _id: p._id,
                playerName: p.playerName,
                role: p.role,
                soldPrice: p.soldPrice || 0,
                photo: p.photo,
                category: p.category,
              })).sort((a: any, b: any) => {
                const c1 = (a.category || '').toUpperCase();
                const c2 = (b.category || '').toUpperCase();
                const o1 = CATEGORY_ORDER[c1] || 99;
                const o2 = CATEGORY_ORDER[c2] || 99;
                if (o1 !== o2) return o1 - o2;
                return b.soldPrice - a.soldPrice;
              }),
            };
          } catch { return { ...team, players: [] }; }
        })
      );
      setTeams(enriched);
    } catch (e) { console.error(e); }
  }, []);

  // Connect to socket with public viewer token
  useEffect(() => {
    let mounted = true;

    const connect = async () => {
      try {
        setLoadingToken(true);
        const host = window.location.hostname;
        const port = window.location.port;
        const protocol = window.location.protocol;

        let backendBase;
        if (port === '5173' || port === '3000') {
          backendBase = `${protocol}//${host}:5000`;
        } else {
          backendBase = port ? `${protocol}//${host}:${port}` : `${protocol}//${host}`;
        }

        // Get public token
        const res = await fetch(`${backendBase}/api/auth/public-token`);
        if (!res.ok) throw new Error('Failed to get public token');
        const { token } = await res.json();

        if (!mounted) return;
        setLoadingToken(false);

        // Fetch initial roster
        fetchRoster(token);

        const sock = io(backendBase, {
          auth: { token },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 2000,
        });

        socketRef.current = sock;

        sock.on('connect', () => { if (mounted) setIsConnected(true); });
        sock.on('disconnect', () => { if (mounted) setIsConnected(false); });

        sock.on('auction:state_update', (state: AuctionState) => {
          if (!mounted) return;
          setAuctionState(state);
          setTimer(state.timerRemaining ?? 15);
          if (state.bidHistory?.length) {
            setBidFeed(
              state.bidHistory.map((h) => ({
                teamName: h.teamId.teamName,
                teamCode: h.teamId.teamCode,
                bidAmount: h.bidAmount,
                timestamp: h.timestamp,
              })).reverse().slice(0, 20)
            );
          }
        });

        sock.on('auction:timer_tick', ({ timerRemaining }: { timerRemaining: number }) => {
          if (mounted) setTimer(timerRemaining);
        });

        sock.on('auction:new_bid', (data: { currentBid: number; highestBidder: any; bidFeedItem: any }) => {
          if (mounted) setBidFeed((prev) => [data.bidFeedItem, ...prev].slice(0, 20));
        });

        // Refresh roster and display overlay when sold/unsold
        sock.on('auction:sold_unsold', (data: any) => {
          if (!mounted) return;
          if (data.status === 'reset') {
            setSoldAnnouncement(null);
            fetchRoster(token);
            return;
          }

          let count = 15;
          const ann = {
            ...data,
            countdown: count,
          };
          setSoldAnnouncement(ann);

          const interval = setInterval(() => {
            count--;
            setSoldAnnouncement((prev: any) => {
              if (!prev) {
                clearInterval(interval);
                return null;
              }
              if (count <= 0) {
                clearInterval(interval);
                return null;
              }
              return { ...prev, countdown: count };
            });
          }, 1000);

          setTimeout(() => fetchRoster(token), 1500);
        });

        sock.on('team:squad_update', () => fetchRoster(token));

      } catch (err) {
        console.error('Public dashboard connect error:', err);
        if (mounted) setLoadingToken(false);
        // retry
        setTimeout(() => { if (mounted) connect(); }, 5000);
      }
    };

    connect();

    return () => {
      mounted = false;
      socketRef.current?.removeAllListeners();
      socketRef.current?.disconnect();
    };
  }, [fetchRoster]);

  const player = auctionState?.currentPlayerId;
  const status = auctionState?.auctionStatus || 'idle';
  const currentBid = auctionState?.currentBid || 0;
  const highestBidder = auctionState?.highestBidderId;
  const timerPct = Math.max(0, (timer / 15) * 100);
  const timerColor = timer > 10 ? '#10B981' : timer > 4 ? '#F97316' : '#EF4444';

  const totalPlayers = teams.reduce((s, t) => s + (t.players?.length || 0), 0);

  if (loadingToken) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 font-semibold text-sm">Connecting to live auction...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      {/* Sold/Unsold Announcement Overlay */}
      {soldAnnouncement && (
        <SoldAnnouncementOverlay
          announcement={soldAnnouncement}
          onDone={() => setSoldAnnouncement(null)}
        />
      )}

      {/* ── Top Nav ───────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 md:px-8 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-blue to-brand-cyan flex items-center justify-center shrink-0">
            <Gavel className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm text-white leading-none">GPL Live Auction</h1>
            <p className="text-[10px] text-slate-400 font-semibold">Public Spectator View</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Live clock */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-slate-400">
            <Clock className="w-3.5 h-3.5" />
            {currentTime.toLocaleTimeString()}
          </div>

          {/* Players stat */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 text-xs font-bold text-slate-300">
            <Users className="w-3 h-3 text-slate-400" />
            {totalPlayers} Sold
          </div>

          {/* Connection */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
            isConnected ? 'bg-emerald-900/60 text-emerald-400' : 'bg-rose-900/60 text-rose-400 animate-pulse'
          }`}>
            {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {isConnected ? 'LIVE' : 'Reconnecting'}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-8">

        {/* ── Live Bidding Arena ──────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className={`w-2.5 h-2.5 rounded-full ${status === 'active' ? 'bg-emerald-400 live-pulse' : status === 'paused' ? 'bg-amber-400 animate-pulse' : 'bg-slate-600'}`} />
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
              {status === 'active' ? 'Live Bidding' : status === 'paused' ? 'Auction Paused' : 'Waiting for Next Player'}
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Player Card */}
            <div className="lg:col-span-3 bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl relative">
              {player ? (
                <div className="relative">
                  {/* Category Accent Line */}
                  {(player.category?.toUpperCase() === 'MARQUEE' || player.category?.toUpperCase() === 'A') && (
                    <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-amber-400 to-emerald-400" />
                  )}
                  {player.category?.toUpperCase() === 'B' && (
                    <div className="h-1.5 w-full bg-gradient-to-r from-sky-500 via-sky-400 to-blue-500" />
                  )}
                  {player.category?.toUpperCase() === 'C' && (
                    <div className="h-1.5 w-full bg-gradient-to-r from-amber-50 via-orange-400 to-amber-500" />
                  )}
                  {player.category?.toUpperCase() === 'D' && (
                    <div className="h-1.5 w-full bg-gradient-to-r from-purple-500 via-indigo-400 to-purple-500" />
                  )}

                  <div className="p-6 flex flex-col sm:flex-row gap-6">
                    {/* Photo */}
                    <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl overflow-hidden bg-slate-800/80 border border-slate-700/50 flex items-center justify-center shrink-0 mx-auto sm:mx-0 shadow-inner relative group">
                      {player.photo ? (
                        <img src={player.photo} alt={player.playerName} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-tr from-slate-800 to-slate-900 flex items-center justify-center">
                          <span className="text-3xl font-black text-slate-500">{player.playerName.slice(0, 2).toUpperCase()}</span>
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 space-y-3 text-center sm:text-left">
                      <div>
                        <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{player.playerName}</h3>
                        <div className="flex flex-wrap gap-2 mt-2 justify-center sm:justify-start">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${ROLE_CHIP[player.role] || 'bg-slate-700 text-slate-300'}`}>
                            {player.role}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
                            Age {player.age}
                          </span>
                          {player.category && (
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                              CATEGORY_CHIP[player.category.toUpperCase()] || 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}>
                              {player.category.toUpperCase() === 'MARQUEE' ? '⭐ MARQUEE' : `CATEGORY ${player.category.toUpperCase()}`}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/30">
                          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Batting</p>
                          <p className="text-xs font-bold text-slate-200 mt-0.5">{player.battingStyle || '—'}</p>
                        </div>
                        <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/30">
                          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Bowling</p>
                          <p className="text-xs font-bold text-slate-200 mt-0.5">{player.bowlingStyle || '—'}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div>
                          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Base Price</p>
                          <p className="text-base font-extrabold text-slate-300">{fmt(player.basePrice)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Current Bid + Timer bar */}
                  <div className="border-t border-slate-800/60 bg-slate-950/40 p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Current Bid</p>
                        <p className="text-3xl font-black text-brand-cyan tracking-tight">
                          {currentBid > 0 ? fmt(currentBid) : <span className="text-slate-600 font-bold">No bids yet</span>}
                        </p>
                      </div>

                      {highestBidder && (
                        <div className="flex items-center gap-2.5 bg-slate-900/80 border border-slate-800 rounded-2xl p-2.5 shadow-md">
                          <div className="text-right">
                            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Current Leader</p>
                            <p className="text-sm font-black text-emerald-400 leading-tight">{highestBidder.teamName}</p>
                            <p className="text-[9px] text-slate-500 font-bold tracking-widest">{highestBidder.teamCode}</p>
                          </div>
                          <div className="w-8 h-8 rounded-full border border-slate-700/50 bg-white flex items-center justify-center shrink-0 overflow-hidden shadow-glow">
                            {highestBidder.logo ? (
                              <img src={highestBidder.logo} alt={highestBidder.teamName} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[10px] font-black text-emerald-600">{highestBidder.teamCode.slice(0, 2)}</span>
                            )}
                          </div>
                        </div>
                      )}

                      {status !== 'idle' && (
                        <div className="text-right">
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Timer</p>
                          <p className="text-3xl font-black" style={{ color: timerColor }}>
                            {String(timer).padStart(2, '0')}s
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Timer bar */}
                    {status !== 'idle' && (
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-1000"
                          style={{ width: `${timerPct}%`, backgroundColor: timerColor }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center gap-4 text-slate-600">
                  <Gavel className="w-12 h-12 animate-pulse" />
                  <div className="text-center">
                    <p className="font-bold text-slate-400">No active player</p>
                    <p className="text-xs text-slate-600 font-semibold mt-1">Waiting for auctioneer to start bidding</p>
                  </div>
                </div>
              )}
            </div>

            {/* Live Bid Feed */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-slate-500" />
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.15em]">Live Bid Feed</h3>
                {isConnected && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 live-pulse" />}
              </div>
              <div className="flex-1 overflow-y-auto max-h-72 lg:max-h-full divide-y divide-slate-800/60">
                {bidFeed.length === 0 ? (
                  <div className="h-32 flex items-center justify-center text-slate-600 text-xs font-semibold">
                    No bids placed yet
                  </div>
                ) : (
                  bidFeed.map((bid, i) => (
                    <div key={i} className={`px-4 py-3 flex items-center justify-between ${i === 0 ? 'bg-emerald-900/20' : ''}`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-400 border border-slate-700`}>
                          {bid.teamCode.slice(0, 2)}
                        </div>
                        <div>
                          <p className={`text-xs font-bold ${i === 0 ? 'text-emerald-400' : 'text-slate-300'}`}>{bid.teamName}</p>
                          <p className="text-[9px] text-slate-600 font-mono">{new Date(bid.timestamp).toLocaleTimeString()}</p>
                        </div>
                      </div>
                      <span className={`text-sm font-extrabold ${i === 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {fmt(bid.bidAmount)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Team Roster Table ───────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
              Squad Roster — All Teams
            </h2>
            <span className="ml-auto text-[10px] font-bold text-slate-600">{totalPlayers} / {teams.length * 10} players sold</span>
          </div>

          {/* Mobile: accordion per team */}
          <div className="lg:hidden space-y-3">
            {teams.map((team, idx) => (
              <div key={team._id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setExpandedTeam(expandedTeam === team._id ? null : team._id)}
                  className={`w-full flex items-center gap-3 p-4 bg-gradient-to-r ${TEAM_GRAD[idx % TEAM_GRAD.length]} cursor-pointer`}
                >
                  {team.logo ? (
                    <img src={team.logo} alt={team.teamName} className="w-8 h-8 rounded-full border-2 border-white/20 object-cover shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-black text-white">{team.teamCode.slice(0, 2)}</span>
                    </div>
                  )}
                  <div className="text-left flex-1 min-w-0">
                    <p className="font-extrabold text-sm text-white truncate">{team.teamName}</p>
                    <p className="text-[10px] text-white/60 font-semibold">{team.players.length}/10 players · {fmt(team.remainingPurse)} left</p>
                  </div>
                  {expandedTeam === team._id
                    ? <ChevronUp className="w-4 h-4 text-white/60 shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-white/60 shrink-0" />
                  }
                </button>

                {expandedTeam === team._id && (
                  <div className="divide-y divide-slate-800">
                    {Array.from({ length: 10 }).map((_, i) => {
                      const p = team.players[i];
                      return (
                        <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                          <span className="text-[10px] font-black text-slate-700 w-4 text-center shrink-0">{i + 1}</span>
                          {p ? (
                            <>
                              <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                                {p.photo
                                  ? <img src={p.photo} alt={p.playerName} className="w-full h-full object-cover" />
                                  : <span className="text-[9px] font-black text-slate-500">{p.playerName.slice(0, 2)}</span>
                                }
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-200 truncate">{p.playerName}</p>
                                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${ROLE_CHIP[p.role] || 'bg-slate-700 text-slate-405'}`}>{p.role}</span>
                                  {p.category && (
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black border ${CATEGORY_CHIP[p.category.toUpperCase()] || 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                                      {getCategoryLabel(p.category)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className="text-xs font-extrabold text-emerald-400 shrink-0">{fmt(p.soldPrice)}</span>
                            </>
                          ) : (
                            <span className="text-xs text-slate-700 font-semibold italic">Empty slot</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop: side-by-side table */}
          <div className="hidden lg:block bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ minWidth: '900px' }}>
                <thead>
                  <tr>
                    <th className="w-10 bg-slate-950 border-r border-b border-slate-800 p-3">
                      <span className="text-[9px] font-black text-slate-600 uppercase">#</span>
                    </th>
                    {teams.map((team, idx) => (
                      <th key={team._id} className="border-r last:border-r-0 border-b border-slate-800 p-0">
                        <div className={`bg-gradient-to-br ${TEAM_GRAD[idx % TEAM_GRAD.length]} p-4`}>
                          <div className="flex items-center gap-2 mb-2">
                            {team.logo ? (
                              <img src={team.logo} alt={team.teamName} className="w-7 h-7 rounded-full border border-white/20 object-cover shrink-0" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                                <span className="text-[9px] font-black text-white">{team.teamCode.slice(0, 2)}</span>
                              </div>
                            )}
                            <div className="text-left min-w-0">
                              <p className="text-sm font-extrabold text-white leading-tight truncate">{team.teamName}</p>
                              <p className="text-[10px] text-white/60 font-semibold truncate">{team.captainName}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <div className="flex-1 text-center bg-black/20 rounded-lg py-1.5">
                              <p className="text-lg font-black text-white leading-none">{team.players.length}<span className="text-xs text-white/50">/10</span></p>
                              <p className="text-[8px] text-white/40 font-bold uppercase">Players</p>
                            </div>
                            <div className="flex-1 text-center bg-black/20 rounded-lg py-1.5 px-1">
                              <p className="text-[11px] font-black text-white leading-none">{fmt(team.remainingPurse)}</p>
                              <p className="text-[8px] text-white/40 font-bold uppercase">Left</p>
                            </div>
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 10 }).map((_, row) => (
                    <tr key={row} className={row % 2 === 0 ? 'bg-slate-900' : 'bg-slate-900/60'}>
                      <td className="border-r border-slate-800 p-2 text-center">
                        <span className="text-[10px] font-black text-slate-700">{row + 1}</span>
                      </td>
                      {teams.map((team) => {
                        const p = team.players[row];
                        return (
                          <td key={team._id} className="border-r last:border-r-0 border-slate-800 p-2 align-top" style={{ minWidth: '160px' }}>
                            {p ? (
                              <div className="flex items-start gap-2">
                                <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                                  {p.photo
                                    ? <img src={p.photo} alt={p.playerName} className="w-full h-full object-cover" />
                                    : <span className="text-[9px] font-black text-slate-500">{p.playerName.slice(0, 2)}</span>
                                  }
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-200 truncate">{p.playerName}</p>
                                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-black ${ROLE_CHIP[p.role] || 'bg-slate-700 text-slate-400'}`}>
                                      {p.role.slice(0, 2).toUpperCase()}
                                    </span>
                                    {p.category && (
                                      <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-black border ${CATEGORY_CHIP[p.category.toUpperCase()] || 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                                        {getCategoryLabel(p.category)}
                                      </span>
                                    )}
                                    <span className="text-[9px] font-bold text-emerald-400">{fmt(p.soldPrice)}</span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 opacity-20">
                                <div className="w-8 h-8 rounded-lg border border-dashed border-slate-700" />
                                <div className="h-2.5 bg-slate-800 rounded w-14" />
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
                {/* Footer spend row */}
                <tfoot>
                  <tr className="border-t-2 border-slate-700 bg-slate-950">
                    <td className="border-r border-slate-800 p-3 text-center">
                      <span className="text-[9px] font-black text-slate-600">∑</span>
                    </td>
                    {teams.map((team, idx) => {
                      const spent = team.initialPurse - team.remainingPurse;
                      const pct = team.initialPurse > 0 ? Math.round((spent / team.initialPurse) * 100) : 0;
                      return (
                        <td key={team._id} className="border-r last:border-r-0 border-slate-800 p-3">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-bold">
                              <span className="text-slate-600">Spent</span>
                              <span className="text-rose-400">{fmt(spent)}</span>
                            </div>
                            <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full bg-gradient-to-r ${TEAM_GRAD[idx % TEAM_GRAD.length]}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <p className="text-[9px] text-slate-600 font-bold text-right">{pct}% used</p>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </section>

        {/* ── Footer ──────────────────────────────────────────── */}
        <footer className="text-center py-4 border-t border-slate-800">
          <p className="text-[10px] text-slate-600 font-semibold">
            GPL Auction System · Public View · Read-Only · Updates in real-time
          </p>
        </footer>
      </div>
    </div>
  );
};

export default PublicDashboard;
