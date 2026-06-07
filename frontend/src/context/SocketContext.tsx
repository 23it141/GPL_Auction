import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { AuctionState, BidFeedItem } from '../types';

interface ToastNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export interface SoldAnnouncement {
  playerName: string;
  teamName: string;
  teamCode: string;
  logo?: string;
  price: number;
  status: 'sold' | 'unsold';
  countdown: number; // seconds until next player
}

interface SocketContextType {
  socket: Socket | null;
  auctionState: AuctionState | null;
  isConnected: boolean;
  bidFeed: BidFeedItem[];
  notifications: ToastNotification[];
  activeCaptains: string[];
  soldAnnouncement: SoldAnnouncement | null;
  clearSoldAnnouncement: () => void;
  placeBid: (bidAmount: number) => void;
  startAuction: (playerId: string) => void;
  pauseAuction: () => void;
  resumeAuction: () => void;
  markSold: () => void;
  markUnsold: () => void;
  reopenPlayer: (playerId: string) => void;
  resetAuction: () => void;
  addToast: (type: ToastNotification['type'], message: string) => void;
  removeToast: (id: string) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

const COUNTDOWN_SECONDS = 15;

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, updatePurse, user, logout } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null);
  const [bidFeed, setBidFeed] = useState<BidFeedItem[]>([]);
  const [notifications, setNotifications] = useState<ToastNotification[]>([]);
  const [activeCaptains, setActiveCaptains] = useState<string[]>([]);
  const [soldAnnouncement, setSoldAnnouncement] = useState<SoldAnnouncement | null>(null);

  // Stable refs for callbacks that shouldn't trigger socket reconnect
  const updatePurseRef = useRef(updatePurse);
  const logoutRef = useRef(logout);
  const userRef = useRef(user);

  useEffect(() => { updatePurseRef.current = updatePurse; }, [updatePurse]);
  useEffect(() => { logoutRef.current = logout; }, [logout]);
  useEffect(() => { userRef.current = user; }, [user]);

  const addToast = useCallback((type: ToastNotification['type'], message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setNotifications((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearSoldAnnouncement = useCallback(() => {
    setSoldAnnouncement(null);
  }, []);

  // ── SOCKET LIFECYCLE ──────────────────────────────────────────────────────
  // CRITICAL: Only depend on `token` — never on `user` or `updatePurse`
  // because those change on purse updates, causing socket disconnect → auth:displaced
  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
      }
      setIsConnected(false);
      return;
    }

    // If already connected with same token, don't reconnect
    if (socketRef.current && socketRef.current.connected) {
      return;
    }

    // Determine host (LAN IP or localhost)
    const host = window.location.hostname;
    const port = window.location.port;
    const protocol = window.location.protocol;

    // Connect to port 5000 if in local Vite development, otherwise use loaded host/port
    let socketUrl;
    if (port === '5173' || port === '3000') {
      socketUrl = `${protocol}//${host}:5000`;
    } else {
      socketUrl = port ? `${protocol}//${host}:${port}` : `${protocol}//${host}`;
    }

    console.log(`[Socket] Connecting to: ${socketUrl}`);

    const newSocket = io(socketUrl, {
      auth: { token },
      // Use both websocket + polling as fallback for iOS/mobile compatibility
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('[Socket] Connected:', newSocket.id);
    });

    newSocket.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log('[Socket] Disconnected:', reason);
      // Auto-reconnect on transport errors (mobile network flakiness)
      if (reason === 'io server disconnect') {
        // Server forced disconnect (e.g. auth:displaced) — don't auto-reconnect
        console.log('[Socket] Server forced disconnect.');
      }
    });

    newSocket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
      setIsConnected(false);
    });

    // ── STATE UPDATE ─────────────────────────────────────────────────────
    newSocket.on('auction:state_update', (state: AuctionState) => {
      setAuctionState(state);

      // Rebuild bid feed from history
      if (state.bidHistory) {
        const feed: BidFeedItem[] = state.bidHistory.map((h) => ({
          teamName: h.teamId.teamName,
          teamCode: h.teamId.teamCode,
          bidAmount: h.bidAmount,
          timestamp: h.timestamp,
        })).reverse();
        setBidFeed(feed);
      }

      // Update purse if we are the highest bidder (use ref to avoid deps)
      const currentUser = userRef.current;
      if (currentUser && currentUser.role === 'captain' && state.highestBidderId) {
        if (state.highestBidderId._id === currentUser.id) {
          updatePurseRef.current(state.highestBidderId.remainingPurse);
        }
      }
    });

    // ── TIMER TICK ───────────────────────────────────────────────────────
    newSocket.on('auction:timer_tick', (data: { timerRemaining: number }) => {
      setAuctionState((prev) => {
        if (!prev) return null;
        return { ...prev, timerRemaining: data.timerRemaining };
      });
    });

    // ── NEW BID ──────────────────────────────────────────────────────────
    newSocket.on('auction:new_bid', (data: { currentBid: number; highestBidder: any; bidFeedItem: BidFeedItem }) => {
      setBidFeed((prev) => [data.bidFeedItem, ...prev.slice(0, 49)]);

      // Small audio feedback
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
      } catch (e) {}
    });

    // ── NOTIFICATION ─────────────────────────────────────────────────────
    newSocket.on('auction:notification', (data: { type: ToastNotification['type']; message: string }) => {
      // Suppress bid placement toasts on captain dashboard to prevent UI lag
      const currentUser = userRef.current;
      if (currentUser && currentUser.role === 'captain' && data.message.includes('placed a bid')) {
        return;
      }
      addToast(data.type, data.message);
    });

    // ── ACTIVE CAPTAINS ──────────────────────────────────────────────────
    newSocket.on('auction:active_captains', (captains: string[]) => {
      setActiveCaptains(captains);
    });

    // ── SOLD / UNSOLD ANNOUNCEMENT ───────────────────────────────────────
    newSocket.on('auction:sold_unsold', (data: any) => {
      const currentUser = userRef.current;

      if (data.status === 'sold') {
        // Start 15-second sold announcement with countdown
        setSoldAnnouncement({
          playerName: data.playerName,
          teamName: data.teamName,
          teamCode: data.teamCode,
          logo: data.logo,
          price: data.price,
          status: 'sold',
          countdown: COUNTDOWN_SECONDS,
        });

        // Fire confetti for the winning captain
        if (currentUser && currentUser.role === 'captain' && currentUser.teamCode === data.teamCode) {
          import('canvas-confetti').then(({ default: confetti }) => {
            confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 }, colors: ['#2563EB', '#10B981', '#F97316', '#8B5CF6', '#FBBF24'] });
            setTimeout(() => confetti({ particleCount: 80, spread: 120, origin: { y: 0.4 } }), 600);
          }).catch(() => {});
          addToast('success', `🎉 YOU WON! ${data.playerName} for ${data.price?.toLocaleString()} pts!`);
        }

      } else if (data.status === 'unsold') {
        setSoldAnnouncement({
          playerName: data.playerName,
          teamName: '',
          teamCode: '',
          price: 0,
          status: 'unsold',
          countdown: COUNTDOWN_SECONDS,
        });

      } else if (data.status === 'reset') {
        setSoldAnnouncement(null);
        addToast('warning', '⚠️ Bidding session reset by the Administrator.');
      }
    });

    // ── DISPLACED (another device logged in as same captain) ─────────────
    newSocket.on('auth:displaced', () => {
      logoutRef.current();
      addToast('error', '⚠️ Disconnected: Another device logged in as your team.');
    });

    // ── BID / ADMIN ERRORS ───────────────────────────────────────────────
    newSocket.on('bid:error', (data: { message: string }) => {
      addToast('error', data.message);
    });

    newSocket.on('admin:error', (data: { message: string }) => {
      addToast('error', data.message);
    });

    return () => {
      console.log('[Socket] Cleanup — disconnecting');
      newSocket.removeAllListeners();
      newSocket.disconnect();
      socketRef.current = null;
    };
  // CRITICAL: Only `token` as dependency — not `user`, not `updatePurse`, not `addToast`
  // Those are accessed via stable refs to prevent socket thrashing
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── COUNTDOWN TICKER for sold announcement ──────────────────────────────
  useEffect(() => {
    if (!soldAnnouncement) return;
    if (soldAnnouncement.countdown <= 0) {
      setSoldAnnouncement(null);
      return;
    }
    const timer = setTimeout(() => {
      setSoldAnnouncement((prev) => {
        if (!prev) return null;
        const next = prev.countdown - 1;
        if (next <= 0) return null;
        return { ...prev, countdown: next };
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [soldAnnouncement]);

  // ── ACTIONS ───────────────────────────────────────────────────────────
  const placeBid = useCallback((bidAmount: number) => {
    socketRef.current?.emit('captain:place_bid', { bidAmount });
  }, []);

  const startAuction = useCallback((playerId: string) => {
    socketRef.current?.emit('admin:start_auction', { playerId });
  }, []);

  const pauseAuction = useCallback(() => {
    socketRef.current?.emit('admin:pause_auction');
  }, []);

  const resumeAuction = useCallback(() => {
    socketRef.current?.emit('admin:resume_auction');
  }, []);

  const markSold = useCallback(() => {
    socketRef.current?.emit('admin:mark_sold');
  }, []);

  const markUnsold = useCallback(() => {
    socketRef.current?.emit('admin:mark_unsold');
  }, []);

  const reopenPlayer = useCallback((playerId: string) => {
    socketRef.current?.emit('admin:reopen_player', { playerId });
  }, []);

  const resetAuction = useCallback(() => {
    socketRef.current?.emit('admin:reset_auction');
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket,
        auctionState,
        isConnected,
        bidFeed,
        notifications,
        activeCaptains,
        soldAnnouncement,
        clearSoldAnnouncement,
        placeBid,
        startAuction,
        pauseAuction,
        resumeAuction,
        markSold,
        markUnsold,
        reopenPlayer,
        resetAuction,
        addToast,
        removeToast,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
