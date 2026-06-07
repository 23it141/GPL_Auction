import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import PlayerCard from '../../components/PlayerCard';
import SoldAnnouncementOverlay from '../../components/SoldAnnouncementOverlay';
import { Landmark, Users, Gavel, Award, ShieldAlert, Check, ChevronDown, ChevronUp, Wifi, WifiOff } from 'lucide-react';
import { Player } from '../../types';

const formatPrice = (amount: number): string => {
  return `${amount.toLocaleString()} pts`;
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

const CaptainDashboard: React.FC = () => {
  const { user, updatePurse, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const {
    socket,
    auctionState,
    isConnected,
    placeBid,
    addToast,
    soldAnnouncement,
    clearSoldAnnouncement,
  } = useSocket();

  const [squad, setSquad] = useState<Player[]>([]);
  const [loadingSquad, setLoadingSquad] = useState(false);
  const [showSquad, setShowSquad] = useState(false);
  const [bidSuccess, setBidSuccess] = useState(false); // flash feedback

  // Store user in ref to avoid stale closure issues
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  // CRITICAL: Wait for auth to finish loading before checking role.
  // Without this guard, user===null during the async /api/auth/me fetch
  // causes an immediate redirect to login even when the captain IS logged in.
  useEffect(() => {
    if (authLoading) return; // still fetching — do nothing
    if (!user) {
      navigate('/captain/login');
    } else if (user.role !== 'captain') {
      navigate('/admin');
    }
  }, [authLoading, user?.role, navigate]);

  const fetchMySquad = async () => {
    const u = userRef.current;
    if (!u || u.role !== 'captain') return;
    try {
      setLoadingSquad(true);
      const res = await fetch(`/api/teams/${u.id}/squad`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('gpl_auth_token')}` },
      });
      if (res.ok) {
        const data = await res.json();
        const sorted = data.sort((a: any, b: any) => {
          const c1 = (a.category || '').toUpperCase();
          const c2 = (b.category || '').toUpperCase();
          const o1 = CATEGORY_ORDER[c1] || 99;
          const o2 = CATEGORY_ORDER[c2] || 99;
          if (o1 !== o2) return o1 - o2;
          return (b.soldPrice || 0) - (a.soldPrice || 0);
        });
        setSquad(sorted);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSquad(false);
    }
  };

  const fetchMyPurse = async () => {
    const u = userRef.current;
    if (!u || u.role !== 'captain') return;
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${localStorage.getItem('gpl_auth_token')}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.purse !== undefined) updatePurse(data.purse);
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchMySquad();
  }, [user?.id, auctionState?.auctionStatus]);

  // Listen for sold events to refresh squad + purse
  useEffect(() => {
    if (!socket || !user) return;

    const handleSoldUnsold = (data: any) => {
      if (data.status === 'sold' && data.teamCode === user.teamCode) {
        fetchMySquad();
        fetchMyPurse();
      } else if (data.status === 'reset') {
        fetchMySquad();
        fetchMyPurse();
      }
    };

    socket.on('auction:sold_unsold', handleSoldUnsold);
    socket.on('team:squad_update', fetchMySquad);
    return () => {
      socket.off('auction:sold_unsold', handleSoldUnsold);
      socket.off('team:squad_update', fetchMySquad);
    };
  }, [socket, user?.teamCode]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-400">Loading session...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'captain') return null;

  const activePlayer = auctionState?.currentPlayerId;
  const status = auctionState?.auctionStatus || 'idle';
  const currentBid = auctionState?.currentBid || 0;
  const highestBidder = auctionState?.highestBidderId;

  const userPurse = user.purse ?? 10000;
  const isHighestBidder = highestBidder && highestBidder._id === user.id;

  // Opening bid = base price; subsequent = currentBid + 1000
  const nextBidAmount = currentBid === 0
    ? (activePlayer?.basePrice ?? 1000)
    : currentBid + 1000;

  const handlePlaceBid = () => {
    if (status !== 'active') {
      addToast('error', 'Auction is not currently active');
      return;
    }
    if (userPurse < nextBidAmount) {
      addToast('error', `Insufficient purse: ${formatPrice(userPurse)}`);
      return;
    }
    placeBid(nextBidAmount);
    // Brief visual success flash
    setBidSuccess(true);
    setTimeout(() => setBidSuccess(false), 1200);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar />

      {/* Sold / Unsold announcement overlay with 15s countdown */}
      {soldAnnouncement && (
        <SoldAnnouncementOverlay
          announcement={soldAnnouncement}
          onDone={clearSoldAnnouncement}
        />
      )}

      <main className="flex-1 p-4 md:p-6 max-w-lg mx-auto w-full space-y-5 overflow-y-auto pb-8">

        {/* Connection Status Banner */}
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
          isConnected
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
            : 'bg-rose-50 border border-rose-200 text-rose-700 animate-pulse'
        }`}>
          {isConnected
            ? <><Wifi className="w-3.5 h-3.5" /> Connected to live auction</>
            : <><WifiOff className="w-3.5 h-3.5" /> Reconnecting to server...</>
          }
          <span className={`ml-auto w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-rose-400'}`} />
        </div>

        {/* Team Purse Header */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white rounded-3xl border border-slate-800 p-5 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Landmark className="w-24 h-24 text-white" />
          </div>

          <div className="flex items-center justify-between relative z-10">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 mb-1.5 bg-white/10 w-fit px-2.5 py-0.5 rounded-full border border-white/5">
                <span className="text-[10px] font-black text-brand-cyan tracking-wider uppercase">
                  {user.teamName} · {user.teamCode}
                </span>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Remaining Purse</span>
              <h2 className="text-3xl font-extrabold text-brand-cyan tracking-tight">
                {formatPrice(userPurse)}
              </h2>
            </div>
            {user.logo && (
              <img
                src={user.logo}
                alt="Logo"
                className="w-14 h-14 rounded-full border-2 border-white/10 bg-white object-cover shadow-lg shrink-0"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 mt-5 pt-4 border-t border-slate-800/80 relative z-10">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase">Squad Slots</p>
                <p className="text-xs font-bold text-slate-200">{squad.length} / 10</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase">Captain</p>
                <p className="text-xs font-bold text-slate-200">{user.captainName || user.teamName}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Live Arena Section */}
        <div className="space-y-4">
          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 pl-1">
            <span className={`w-2.5 h-2.5 rounded-full ${status === 'active' ? 'bg-brand-green live-pulse' : status === 'paused' ? 'bg-amber-400 animate-pulse' : 'bg-slate-300'}`} />
            {status === 'active' ? 'Live Bidding' : status === 'paused' ? 'Auction Paused' : 'Waiting for Player'}
          </h3>

          {activePlayer ? (
            <div className="space-y-4">
              <PlayerCard player={activePlayer} />

              {/* Bidding Panel */}
              <div className={`bg-white rounded-3xl border shadow-premium p-5 space-y-4 transition-all ${
                bidSuccess ? 'border-emerald-400 shadow-emerald-100' : 'border-slate-200'
              }`}>
                {/* Current bid header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current Bid</span>
                    <p className={`text-xl font-black transition-all ${currentBid > 0 ? 'text-brand-blue' : 'text-slate-400'}`}>
                      {currentBid > 0 ? formatPrice(currentBid) : 'No bids yet'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Leader</span>
                    <p className={`text-xs font-extrabold ${isHighestBidder ? 'text-emerald-600' : 'text-slate-700'}`}>
                      {highestBidder ? `${highestBidder.teamName}` : 'None'}
                    </p>
                  </div>
                </div>

                {/* You're winning badge */}
                {isHighestBidder && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-2xl flex items-center justify-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" />
                    YOU HOLD THE HIGHEST BID — HOLD TIGHT!
                  </div>
                )}

                {/* Paused state */}
                {status === 'paused' && (
                  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold rounded-2xl flex items-center justify-center gap-2">
                    <ShieldAlert className="w-4 h-4" />
                    AUCTION PAUSED BY AUCTIONEER
                  </div>
                )}

                {/* Squad full */}
                {squad.length >= 10 && (
                  <div className="p-3 bg-slate-50 border border-slate-200 text-slate-500 text-xs font-bold rounded-2xl text-center">
                    Squad Full (10/10) — You cannot bid further
                  </div>
                )}

                {/* BID BUTTON — only shown when active, not highest bidder, squad not full */}
                {status === 'active' && !isHighestBidder && squad.length < 10 && (
                  <div className="space-y-2">
                    <button
                      onClick={handlePlaceBid}
                      disabled={userPurse < nextBidAmount}
                      className={`w-full py-5 font-extrabold text-lg rounded-2xl shadow-premium cursor-pointer transition-all duration-150 active:scale-95 tracking-wide
                        ${userPurse < nextBidAmount
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                          : bidSuccess
                          ? 'bg-emerald-500 text-white shadow-emerald-200'
                          : 'bg-brand-blue hover:bg-brand-blue-dark text-white hover:shadow-xl'
                        }`}
                    >
                      {bidSuccess ? '✓ BID PLACED!' : 'BID +1,000 pts'}
                    </button>
                    <p className="text-center text-[11px] text-slate-400 font-semibold">
                      Your bid will be{' '}
                      <span className="font-black text-slate-600">{formatPrice(nextBidAmount)}</span>
                      {userPurse < nextBidAmount && (
                        <span className="text-rose-500"> · Insufficient purse</span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 font-medium shadow-premium space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center">
                <Gavel className="w-8 h-8 text-slate-300 animate-pulse" />
              </div>
              <p className="text-sm font-bold text-slate-700">Waiting for next player...</p>
              <p className="text-[10px] text-slate-400 max-w-xs mx-auto">
                The auctioneer will start the next bidding round shortly. Stay tuned.
              </p>
            </div>
          )}
        </div>

        {/* Purchased Squad Accordion */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-premium overflow-hidden">
          <button
            onClick={() => setShowSquad(!showSquad)}
            className="w-full p-4 bg-slate-50 hover:bg-slate-100/60 border-b border-slate-100 flex items-center justify-between font-bold text-slate-800 text-xs uppercase tracking-wider cursor-pointer transition-colors"
          >
            <span className="flex items-center gap-2">
              My Squad
              <span className="px-2 py-0.5 rounded-full bg-brand-blue text-white text-[10px] font-black">{squad.length}/10</span>
            </span>
            {showSquad ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {showSquad && (
            <div className="p-4 divide-y divide-slate-100 max-h-64 overflow-y-auto custom-scrollbar">
              {loadingSquad ? (
                <p className="text-center text-xs text-slate-400 py-4 font-semibold">Updating squad list...</p>
              ) : squad.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-6 font-semibold italic">No players acquired yet.</p>
              ) : (
                squad.map((player, idx) => (
                  <div key={player._id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{idx + 1}. {player.playerName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[9px] text-slate-400 font-bold uppercase">{player.role}</span>
                        {player.category && (
                          <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[8px] font-black border tracking-wider ${
                            CATEGORY_COLORS[player.category.toUpperCase()] || 'bg-slate-50 text-slate-500 border-slate-200'
                          }`}>
                            {getCategoryLabel(player.category)}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-sm font-extrabold text-brand-green">
                      {formatPrice(player.soldPrice || 0)}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default CaptainDashboard;
