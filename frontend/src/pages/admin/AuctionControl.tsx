import React, { useState, useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';
import { Player } from '../../types';
import PlayerCard from '../../components/PlayerCard';
import LiveBidFeed from '../../components/LiveBidFeed';
import SoldAnnouncementOverlay from '../../components/SoldAnnouncementOverlay';
import { Play, Pause, Square, CheckCircle, AlertCircle, RefreshCw, ChevronRight, UserPlus, Clock } from 'lucide-react';

const formatPrice = (amount: number): string => {
  return `${amount.toLocaleString()} pts`;
};

const AuctionControl: React.FC = () => {
  const {
    auctionState,
    bidFeed,
    startAuction,
    pauseAuction,
    resumeAuction,
    markSold,
    markUnsold,
    activeCaptains,
    addToast,
    soldAnnouncement,
    clearSoldAnnouncement,
  } = useSocket();

  const [waitingPlayers, setWaitingPlayers] = useState<Player[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [teams, setTeams] = useState<any[]>([]);

  const fetchTeams = async () => {
    try {
      const res = await fetch('/api/teams', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('gpl_auth_token')}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setTeams(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchWaitingPlayers = async () => {
    try {
      setLoadingPlayers(true);
      // Fetch players with waiting or unsold status
      const res = await fetch('/api/players', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('gpl_auth_token')}`,
        },
      });
      if (res.ok) {
        const data: Player[] = await res.json();
        // Filter out sold/active ones
        const filtered = data.filter(p => p.soldStatus === 'waiting' || p.soldStatus === 'unsold');
        setWaitingPlayers(filtered);
        if (filtered.length > 0 && !selectedPlayerId) {
          setSelectedPlayerId(filtered[0]._id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPlayers(false);
    }
  };

  useEffect(() => {
    fetchWaitingPlayers();
    fetchTeams();
  }, [auctionState?.auctionStatus]); // Refetch when auction state changes (e.g. player sold/unsold)

  const handleStart = () => {
    if (!selectedPlayerId) {
      addToast('warning', 'Please select a player to auction first');
      return;
    }
    startAuction(selectedPlayerId);
  };

  const activePlayer = auctionState?.currentPlayerId;
  const status = auctionState?.auctionStatus || 'idle';
  const currentBid = auctionState?.currentBid || 0;
  const highestBidder = auctionState?.highestBidderId;
  const timer = auctionState?.timerRemaining ?? 15;

  // Determine timer bar colors
  const timerColor = timer > 10 
    ? 'bg-brand-green' 
    : timer > 4 
    ? 'bg-brand-orange' 
    : 'bg-rose-500 live-pulse';

  const getPlayersByCategory = (category: string) => {
    return waitingPlayers.filter(p => {
      const cat = (p.category || '').toUpperCase();
      if (category === 'A') return cat === 'A' || cat === 'MARQUEE';
      if (category === 'B') return cat === 'B' || cat === 'CAPPED';
      if (category === 'C') return cat === 'C' || cat === 'UNCAPPED';
      if (category === 'D') return cat === 'D';
      return false;
    });
  };

  const playersA = getPlayersByCategory('A');
  const playersB = getPlayersByCategory('B');
  const playersC = getPlayersByCategory('C');
  const playersD = getPlayersByCategory('D');

  const getPlayerAt = (rowIndex: number, colIndex: number): Player | undefined => {
    let categoryRowOffset = 0;
    let categoryPlayers: Player[] = [];

    if (rowIndex < 3) {
      categoryRowOffset = rowIndex;
      categoryPlayers = playersA;
    } else if (rowIndex < 6) {
      categoryRowOffset = rowIndex - 3;
      categoryPlayers = playersB;
    } else if (rowIndex < 8) {
      categoryRowOffset = rowIndex - 6;
      categoryPlayers = playersC;
    } else {
      categoryRowOffset = rowIndex - 8;
      categoryPlayers = playersD;
    }

    const playerIndex = categoryRowOffset * 5 + colIndex;
    return categoryPlayers[playerIndex];
  };

  return (
    <div className="space-y-6">
      {/* Sold Announcement Overlay for admin */}
      {soldAnnouncement && (
        <SoldAnnouncementOverlay
          announcement={soldAnnouncement}
          onDone={clearSoldAnnouncement}
        />
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* LEFT & CENTER PANEL (Active Player & Controls) */}
        <div className="xl:col-span-2 space-y-6">
          {/* Franchise Connection Monitor Banner */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-premium p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                Live Captain Status
              </span>
              <div className="flex flex-wrap gap-2.5">
                {teams.length === 0 ? (
                  <span className="text-xs text-slate-400 font-semibold italic">No franchises registered</span>
                ) : (
                  teams.map((team) => {
                    const isConnected = activeCaptains.includes(team.teamCode);
                    return (
                      <div
                        key={team._id}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all ${
                          isConnected
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800 shadow-sm font-semibold'
                            : 'bg-slate-50 border-slate-200 text-slate-400'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 shadow-glow live-pulse' : 'bg-slate-300'}`} />
                        <span className="text-xs font-bold font-mono tracking-wider">{team.teamCode}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
          {/* Active Player Card & Visual Timer */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-premium p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${status === 'active' ? 'bg-brand-green live-pulse' : status === 'paused' ? 'bg-amber-400' : 'bg-slate-300'}`} />
                {status === 'idle' ? 'Lobby / Idle' : status === 'paused' ? 'Auction Paused' : 'Live Bidding'}
              </h2>
              {status !== 'idle' && (
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border font-mono text-sm font-bold transition-colors ${
                  timer <= 5
                    ? 'bg-rose-50 border-rose-200 text-rose-600 animate-pulse'
                    : timer <= 10
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-slate-100 border-slate-200 text-slate-700'
                }`}>
                  <Clock className={`w-4 h-4 ${timer <= 5 ? 'text-rose-500' : 'text-slate-500'}`} />
                  <span>0:{(timer < 10 ? '0' : '') + timer}</span>
                  {timer <= 10 && <span className="text-[9px] font-black uppercase tracking-wider ml-1">{timer <= 5 ? '⚡ CLOSING' : 'HURRY!'}</span>}
                </div>
              )}
            </div>

            {/* Progress Bar Timer */}
            {status !== 'idle' && (
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-1000 ${timerColor}`}
                  style={{ width: `${(timer / 15) * 100}%` }}
                />
              </div>
            )}

            {activePlayer ? (
              <div className="space-y-6">
                <PlayerCard player={activePlayer} />

                {/* Live Bidding Overview Banner */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 text-center space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current Highest Bid</p>
                    <p className="text-3xl font-extrabold text-brand-blue">
                      {currentBid > 0 ? formatPrice(currentBid) : 'No Bids Placed'}
                    </p>
                    {currentBid === 0 && (
                      <p className="text-[10px] font-bold text-slate-400">Opening Bid starts at base price</p>
                    )}
                  </div>

                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Highest Bidder</p>
                    {highestBidder ? (
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full border border-slate-200 bg-white flex items-center justify-center shrink-0 overflow-hidden">
                          {highestBidder.logo ? (
                            <img src={highestBidder.logo} alt={highestBidder.teamName} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] font-black text-brand-blue">{highestBidder.teamCode}</span>
                          )}
                        </div>
                        <span className="text-sm font-extrabold text-slate-800">
                          {highestBidder.teamName} ({highestBidder.teamCode})
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-slate-400 mt-1">Waiting for Bids...</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-slate-400 font-medium space-y-3">
                <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto text-slate-300 shadow-inner">
                  <UserPlus className="w-7 h-7" />
                </div>
                <p className="text-sm font-bold text-slate-700">No Active Player in Ring</p>
                <p className="text-xs max-w-sm mx-auto text-slate-400 font-semibold leading-relaxed">
                  Select a cricketer from the waiting queue table below and click "Start Auction" to launch real-time bidding.
                </p>
              </div>
            )}
          </div>

          {/* Administration Action Controls */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-premium p-6 space-y-4">
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
              Auctioneer Action Panel
            </h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Start Button */}
              {status === 'idle' && (
                <button
                  onClick={handleStart}
                  disabled={!selectedPlayerId}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl bg-brand-blue hover:bg-brand-blue-dark text-white font-bold text-xs gap-2 transition-all cursor-pointer shadow-premium"
                >
                  <Play className="w-5 h-5" />
                  Start Bidding
                </button>
              )}

              {/* Pause/Resume buttons */}
              {status === 'active' && (
                <button
                  onClick={pauseAuction}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs gap-2 transition-all cursor-pointer"
                >
                  <Pause className="w-5 h-5" />
                  Pause Timer
                </button>
              )}

              {status === 'paused' && (
                <button
                  onClick={resumeAuction}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl bg-brand-blue hover:bg-brand-blue-dark text-white font-bold text-xs gap-2 transition-all cursor-pointer"
                >
                  <Play className="w-5 h-5" />
                  Resume Timer
                </button>
              )}

              {/* Sold Button */}
              {status !== 'idle' && (
                <button
                  onClick={markSold}
                  disabled={!highestBidder}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold text-xs gap-2 transition-all cursor-pointer shadow-premium"
                >
                  <CheckCircle className="w-5 h-5" />
                  Force SOLD
                </button>
              )}

              {/* Unsold Button */}
              {status !== 'idle' && (
                <button
                  onClick={markUnsold}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs gap-2 transition-all cursor-pointer shadow-premium"
                >
                  <Square className="w-5 h-5" />
                  Force UNSOLD
                </button>
              )}
            </div>

            {status !== 'idle' && (
              <p className="text-[10px] text-slate-400 font-semibold text-center mt-2 flex items-center justify-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                ⏱ Timer auto-sells to highest bidder at 0:00 · Use Force buttons to override early
              </p>
            )}
          </div>
        </div>

        {/* RIGHT PANEL (Scrolling Bids) */}
        <div className="space-y-6">
          <div className="h-[430px]">
            <LiveBidFeed bids={bidFeed} />
          </div>
        </div>
      </div>

      {/* FULL WIDTH BOTTOM PANEL (Category Queue Grid Table) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-premium p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
              Waiting Player Queue Grid
            </h3>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
              Select a player to launch from the category-wise waiting list (5 Columns x 10 Rows)
            </p>
          </div>
          <button
            onClick={fetchWaitingPlayers}
            className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-500 text-xs font-bold rounded-xl cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh Queue
          </button>
        </div>

        <div className="overflow-x-auto">
          {loadingPlayers ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 font-semibold gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-brand-blue" />
              <span className="text-xs">Loading queue...</span>
            </div>
          ) : waitingPlayers.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center text-slate-400 p-4">
              <p className="text-xs font-semibold">Queue is empty!</p>
              <p className="text-[10px] text-slate-400 mt-1">All players are either sold or catalog is empty.</p>
            </div>
          ) : (
            <table className="w-full border-collapse" style={{ minWidth: '800px' }}>
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-3 py-2 text-xs font-bold text-slate-400 uppercase w-28 text-center">Category</th>
                  <th className="px-3 py-2 text-xs font-bold text-slate-400 uppercase text-center">Col 1</th>
                  <th className="px-3 py-2 text-xs font-bold text-slate-400 uppercase text-center">Col 2</th>
                  <th className="px-3 py-2 text-xs font-bold text-slate-400 uppercase text-center">Col 3</th>
                  <th className="px-3 py-2 text-xs font-bold text-slate-400 uppercase text-center">Col 4</th>
                  <th className="px-3 py-2 text-xs font-bold text-slate-400 uppercase text-center">Col 5</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 10 }).map((_, rowIndex) => {
                  let rowBg = '';
                  let catLabel = '';
                  let catTextColor = '';
                  let btnBg = '';
                  let btnHover = '';
                  let btnBorder = '';
                  let emptyCellBorder = '';
                  let emptyCellBg = '';

                  if (rowIndex < 3) {
                    rowBg = 'bg-emerald-50/60';
                    catTextColor = 'text-emerald-700 bg-emerald-100/80 border-emerald-200/60';
                    catLabel = 'Category A';
                    btnBg = 'bg-emerald-50/80';
                    btnHover = 'hover:bg-emerald-100/70 hover:border-emerald-300';
                    btnBorder = 'border-emerald-200/50';
                    emptyCellBorder = 'border-emerald-200/40';
                    emptyCellBg = 'bg-emerald-50/20 text-emerald-400/60';
                  } else if (rowIndex < 6) {
                    rowBg = 'bg-sky-50/60';
                    catTextColor = 'text-sky-700 bg-sky-100/80 border-sky-200/60';
                    catLabel = 'Category B';
                    btnBg = 'bg-sky-50/80';
                    btnHover = 'hover:bg-sky-100/70 hover:border-sky-300';
                    btnBorder = 'border-sky-200/50';
                    emptyCellBorder = 'border-sky-200/40';
                    emptyCellBg = 'bg-sky-50/20 text-sky-400/60';
                  } else if (rowIndex < 8) {
                    rowBg = 'bg-amber-50/60';
                    catTextColor = 'text-amber-700 bg-amber-100/80 border-amber-200/60';
                    catLabel = 'Category C';
                    btnBg = 'bg-amber-50/80';
                    btnHover = 'hover:bg-amber-100/70 hover:border-amber-300';
                    btnBorder = 'border-amber-200/50';
                    emptyCellBorder = 'border-amber-200/40';
                    emptyCellBg = 'bg-amber-50/20 text-amber-400/60';
                  } else {
                    rowBg = 'bg-purple-50/60';
                    catTextColor = 'text-purple-700 bg-purple-100/80 border-purple-200/60';
                    catLabel = 'Category D';
                    btnBg = 'bg-purple-50/80';
                    btnHover = 'hover:bg-purple-100/70 hover:border-purple-300';
                    btnBorder = 'border-purple-200/50';
                    emptyCellBorder = 'border-purple-200/40';
                    emptyCellBg = 'bg-purple-50/20 text-purple-400/60';
                  }

                  return (
                    <tr key={rowIndex} className={`${rowBg} border-b border-slate-150 last:border-b-0`}>
                      <td className="p-2 align-middle text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider block text-center ${catTextColor}`}>
                          {catLabel}
                        </span>
                      </td>
                      
                      {Array.from({ length: 5 }).map((_, colIndex) => {
                        const player = getPlayerAt(rowIndex, colIndex);
                        if (player) {
                          const isSelected = selectedPlayerId === player._id;
                          return (
                            <td key={colIndex} className="p-1.5">
                              <button
                                disabled={status !== 'idle'}
                                onClick={() => setSelectedPlayerId(player._id)}
                                className={`w-full p-2.5 rounded-xl border text-left flex flex-col transition-all cursor-pointer ${
                                  isSelected
                                    ? 'border-brand-blue bg-white ring-2 ring-brand-blue ring-offset-1 shadow-sm font-bold scale-[1.02]'
                                    : `${btnBorder} ${btnBg} ${btnHover} text-slate-800 hover:shadow-xs`
                                } ${status !== 'idle' ? 'opacity-60 cursor-not-allowed' : ''}`}
                              >
                                <span className="text-xs font-extrabold text-slate-800 truncate block max-w-[140px]">
                                  {player.playerName}
                                </span>
                                <span className="text-[9px] font-semibold text-slate-500 mt-1 flex items-center justify-between">
                                  <span className="truncate">{player.role}</span>
                                  <span className="font-extrabold text-slate-600 shrink-0 ml-1">{formatPrice(player.basePrice)}</span>
                                </span>
                              </button>
                            </td>
                          );
                        } else {
                          return (
                            <td key={colIndex} className="p-1.5">
                              <div className={`w-full h-[52px] rounded-xl border border-dashed flex items-center justify-center text-[10px] font-semibold italic select-none ${emptyCellBorder} ${emptyCellBg}`}>
                                &mdash;
                              </div>
                            </td>
                          );
                        }
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuctionControl;
