import React, { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../../context/SocketContext';
import { RefreshCw, Trophy, Landmark, Users, Download } from 'lucide-react';

interface TeamWithSquad {
  _id: string;
  teamName: string;
  teamCode: string;
  captainName: string;
  logo?: string;
  initialPurse: number;
  remainingPurse: number;
  squadSize: number;
  players: PlayerSlot[];
}

interface PlayerSlot {
  _id: string;
  playerName: string;
  role: string;
  soldPrice: number;
  photo?: string;
  category?: string;
}

const ROLE_COLORS: Record<string, string> = {
  'Batsman':        'bg-sky-50 text-sky-700 border-sky-200',
  'Bowler':         'bg-rose-50 text-rose-700 border-rose-200',
  'All-Rounder':    'bg-violet-50 text-violet-700 border-violet-200',
  'Wicket-Keeper':  'bg-amber-50 text-amber-700 border-amber-200',
};

const CATEGORY_COLORS: Record<string, string> = {
  'A': 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
  'B': 'bg-sky-50 text-sky-700 border-sky-200/60',
  'C': 'bg-amber-50 text-amber-700 border-amber-200/60',
  'D': 'bg-purple-50 text-purple-700 border-purple-200/60',
  'MARQUEE': 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
  'CAPPED': 'bg-sky-50 text-sky-700 border-sky-200/60',
  'UNCAPPED': 'bg-amber-50 text-amber-700 border-amber-200/60',
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

const ROLE_SHORT: Record<string, string> = {
  'Batsman': 'BAT',
  'Bowler': 'BWL',
  'All-Rounder': 'AR',
  'Wicket-Keeper': 'WK',
};

const TEAM_GRADIENTS = [
  'from-blue-600 to-blue-800',
  'from-emerald-600 to-emerald-800',
  'from-orange-500 to-orange-700',
  'from-purple-600 to-purple-800',
  'from-cyan-600 to-cyan-800',
];

const formatPrice = (amount: number) => `${amount.toLocaleString()} pts`;

const MAX_PLAYERS = 10;

const TeamRosterPage: React.FC = () => {
  const { auctionState } = useSocket();
  const [teams, setTeams] = useState<TeamWithSquad[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchRoster = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('gpl_auth_token');
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch all teams
      const teamsRes = await fetch('/api/teams', { headers });
      if (!teamsRes.ok) throw new Error('Failed to load teams');
      const teamsData = await teamsRes.json();

      // Fetch each team's squad in parallel
      const enriched: TeamWithSquad[] = await Promise.all(
        teamsData.map(async (team: any, idx: number) => {
          try {
            const squadRes = await fetch(`/api/teams/${team._id}/squad`, { headers });
            const players = squadRes.ok ? await squadRes.json() : [];
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
          } catch {
            return { ...team, players: [] };
          }
        })
      );

      setTeams(enriched);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoster();
  }, [fetchRoster, auctionState?.auctionStatus]);

  // Summary stats
  const totalSpent = teams.reduce((sum, t) => sum + (t.initialPurse - t.remainingPurse), 0);
  const totalPlayers = teams.reduce((sum, t) => sum + t.players.length, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-500" />
            Squad Roster Table
          </h1>
          <p className="text-slate-400 text-xs font-semibold mt-1">
            All 5 franchises · {totalPlayers} players acquired · Live updates
            {lastUpdated && (
              <span className="ml-2 text-slate-300">
                · Refreshed {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={fetchRoster}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-blue hover:bg-brand-blue-dark text-white text-xs font-bold rounded-xl shadow-premium transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Refreshing...' : 'Refresh Roster'}
        </button>
      </div>

      {/* Summary stat pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {teams.map((team, idx) => (
          <div
            key={team._id}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex items-center gap-3"
          >
            {team.logo ? (
              <img src={team.logo} alt={team.teamName} className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0" />
            ) : (
              <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${TEAM_GRADIENTS[idx % TEAM_GRADIENTS.length]} flex items-center justify-center shrink-0`}>
                <span className="text-[10px] font-black text-white">{team.teamCode.slice(0, 2)}</span>
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">{team.teamCode}</p>
              <p className="text-sm font-extrabold text-slate-800 truncate">{team.players.length}<span className="text-slate-400 font-semibold">/10</span></p>
            </div>
          </div>
        ))}

        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
            <Landmark className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Total Spent</p>
            <p className="text-sm font-extrabold text-amber-700">{formatPrice(totalSpent)}</p>
          </div>
        </div>
      </div>

      {/* Main Roster Table */}
      {loading && teams.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-premium p-16 flex flex-col items-center justify-center gap-4">
          <RefreshCw className="w-8 h-8 text-brand-blue animate-spin" />
          <p className="text-sm font-bold text-slate-500">Loading squad roster...</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-premium overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: '900px' }}>
              {/* Team Header Row */}
              <thead>
                <tr>
                  {/* Row number header */}
                  <th className="w-12 bg-slate-50 border-r border-b border-slate-200 p-3 text-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">#</span>
                  </th>

                  {teams.map((team, idx) => (
                    <th
                      key={team._id}
                      className="border-r last:border-r-0 border-b border-slate-200 p-0"
                    >
                      {/* Gradient team header */}
                      <div className={`bg-gradient-to-br ${TEAM_GRADIENTS[idx % TEAM_GRADIENTS.length]} p-4 text-white`}>
                        <div className="flex items-center gap-2.5">
                          {team.logo ? (
                            <img
                              src={team.logo}
                              alt={team.teamName}
                              className="w-8 h-8 rounded-full border-2 border-white/30 object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center shrink-0">
                              <span className="text-[10px] font-black">{team.teamCode.slice(0, 2)}</span>
                            </div>
                          )}
                          <div className="text-left min-w-0">
                            <p className="font-extrabold text-sm leading-tight truncate">{team.teamName}</p>
                            <p className="text-[10px] font-bold text-white/70 truncate">{team.captainName}</p>
                          </div>
                        </div>

                        {/* Team stats */}
                        <div className="mt-3 pt-3 border-t border-white/20 grid grid-cols-2 gap-2">
                          <div className="text-center">
                            <p className="text-[9px] font-bold text-white/60 uppercase tracking-wider">Players</p>
                            <p className="text-lg font-black text-white leading-none">
                              {team.players.length}
                              <span className="text-xs font-bold text-white/50">/10</span>
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-[9px] font-bold text-white/60 uppercase tracking-wider">Remaining</p>
                            <p className="text-xs font-black text-white leading-none">{formatPrice(team.remainingPurse)}</p>
                          </div>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Player Rows (10 rows) */}
              <tbody>
                {Array.from({ length: MAX_PLAYERS }).map((_, rowIdx) => (
                  <tr
                    key={rowIdx}
                    className={`transition-colors ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'} hover:bg-brand-blue/3`}
                  >
                    {/* Row number */}
                    <td className="border-r border-slate-100 p-2 text-center">
                      <span className="text-[11px] font-black text-slate-300 font-mono">{rowIdx + 1}</span>
                    </td>

                    {/* Player cell for each team */}
                    {teams.map((team, colIdx) => {
                      const player = team.players[rowIdx];
                      return (
                        <td
                          key={team._id}
                          className="border-r last:border-r-0 border-slate-100 p-2 align-top"
                          style={{ minWidth: '160px' }}
                        >
                          {player ? (
                            <div className="flex items-start gap-2 group">
                              {/* Player avatar / photo */}
                              <div className="shrink-0 w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                                {player.photo ? (
                                  <img
                                    src={player.photo}
                                    alt={player.playerName}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span className="text-[10px] font-black text-slate-400 uppercase">
                                    {player.playerName.slice(0, 2)}
                                  </span>
                                )}
                              </div>

                              {/* Player details */}
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-slate-800 leading-tight truncate">
                                  {player.playerName}
                                </p>
                                <div className="flex flex-wrap items-center gap-1 mt-1">
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-black border tracking-wider ${ROLE_COLORS[player.role] || 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                    {ROLE_SHORT[player.role] || player.role.slice(0, 3).toUpperCase()}
                                  </span>
                                  {player.category && (
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-black border tracking-wider ${CATEGORY_COLORS[player.category.toUpperCase()] || 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                      {getCategoryLabel(player.category)}
                                    </span>
                                  )}
                                  <span className="text-[9px] font-bold text-brand-green whitespace-nowrap">
                                    {formatPrice(player.soldPrice)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            // Empty slot
                            <div className="flex items-center gap-2 opacity-30">
                              <div className="w-8 h-8 rounded-lg border border-dashed border-slate-300 flex items-center justify-center shrink-0">
                                <span className="text-slate-300 text-[10px]">—</span>
                              </div>
                              <div className="h-3 bg-slate-200 rounded w-16" />
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>

              {/* Footer: Totals row */}
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td className="border-r border-slate-200 p-3 text-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase">∑</span>
                  </td>
                  {teams.map((team, idx) => {
                    const spent = team.initialPurse - team.remainingPurse;
                    return (
                      <td key={team._id} className="border-r last:border-r-0 border-slate-200 p-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Spent</span>
                            <span className="text-xs font-extrabold text-rose-600">{formatPrice(spent)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Left</span>
                            <span className="text-xs font-extrabold text-emerald-600">{formatPrice(team.remainingPurse)}</span>
                          </div>
                          {/* Mini spend bar */}
                          <div className="h-1 bg-slate-200 rounded-full overflow-hidden mt-1">
                            <div
                              className={`h-full bg-gradient-to-r ${TEAM_GRADIENTS[idx % TEAM_GRADIENTS.length]} rounded-full transition-all duration-700`}
                              style={{
                                width: `${team.initialPurse > 0 ? Math.min(100, (spent / team.initialPurse) * 100) : 0}%`
                              }}
                            />
                          </div>
                          <p className="text-[9px] text-slate-400 font-semibold text-right">
                            {team.initialPurse > 0 ? Math.round((spent / team.initialPurse) * 100) : 0}% used
                          </p>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
        <span>Role Legend:</span>
        {Object.entries(ROLE_SHORT).map(([role, short]) => (
          <span
            key={role}
            className={`px-2 py-0.5 rounded border ${ROLE_COLORS[role] || ''}`}
          >
            {short} = {role}
          </span>
        ))}
      </div>
    </div>
  );
};

export default TeamRosterPage;
