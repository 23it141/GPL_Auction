import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import AuctionState from '../models/AuctionState';
import Player from '../models/Player';
import Team from '../models/Team';
import Bid from '../models/Bid';
import AuditLog from '../models/AuditLog';

const JWT_SECRET = process.env.JWT_SECRET || 'gpl_auction_super_secret_key';

// Keep timer state in-memory to prevent hammering the database every second
export interface InMemoryAuctionTimer {
  timerRemaining: number;
  timerInterval: NodeJS.Timeout | null;
}

export const auctionTimer: InMemoryAuctionTimer = {
  timerRemaining: 15,
  timerInterval: null,
};

// Helper to format currency for logs/notifications (e.g. 1.5 Cr, 20 Lakhs)
const formatPrice = (amount: number): string => {
  return `${amount.toLocaleString()} pts`;
};

// Broadcast full current state
export const broadcastState = async (io: Server) => {
  try {
    let state = await AuctionState.findOne();
    if (!state) {
      state = new AuctionState();
      await state.save();
    }

    const populatedState = await AuctionState.findById(state._id)
      .populate({
        path: 'currentPlayerId',
        model: 'Player',
        populate: { path: 'soldTo', select: 'teamName teamCode' }
      })
      .populate('highestBidderId', 'teamName teamCode logo remainingPurse')
      .populate({
        path: 'bidHistory.teamId',
        select: 'teamName teamCode logo'
      });

    io.emit('auction:state_update', {
      ...populatedState?.toObject(),
      timerRemaining: auctionTimer.timerRemaining,
    });
  } catch (error) {
    console.error('Error broadcasting auction state:', error);
  }
};

export const startTimer = (io: Server) => {
  if (auctionTimer.timerInterval) {
    clearInterval(auctionTimer.timerInterval);
    auctionTimer.timerInterval = null;
  }

  auctionTimer.timerInterval = setInterval(async () => {
    try {
      const state = await AuctionState.findOne();

      if (!state || state.auctionStatus !== 'active') {
        clearInterval(auctionTimer.timerInterval!);
        auctionTimer.timerInterval = null;
        return;
      }

      if (auctionTimer.timerRemaining > 0) {
        auctionTimer.timerRemaining--;
        io.emit('auction:timer_tick', { timerRemaining: auctionTimer.timerRemaining });
        return;
      }

      // ── TIMER HIT ZERO ──────────────────────────────────────────────
      clearInterval(auctionTimer.timerInterval!);
      auctionTimer.timerInterval = null;
      io.emit('auction:timer_expired');

      const player = state.currentPlayerId
        ? await Player.findById(state.currentPlayerId)
        : null;

      if (!player) return;

      if (state.highestBidderId && state.currentBid > 0) {
        // ── AUTO SOLD to highest bidder ────────────────────────────
        const team = await Team.findById(state.highestBidderId);
        if (!team) return;

        const finalPrice = state.currentBid;

        team.remainingPurse -= finalPrice;
        team.squadSize += 1;
        await team.save();

        player.soldStatus = 'sold';
        player.soldPrice = finalPrice;
        player.soldTo = team._id as any;
        await player.save();

        state.auctionStatus = 'idle';
        await state.save();

        await AuditLog.create({
          action: 'AUTO_SOLD',
          details: `Timer expired — Auto-sold ${player.playerName} to ${team.teamName} for ${formatPrice(finalPrice)}`,
          performedBy: 'SYSTEM',
        });

        io.emit('auction:sold_unsold', {
          status: 'sold',
          playerName: player.playerName,
          teamName: team.teamName,
          teamCode: team.teamCode,
          logo: team.logo,
          price: finalPrice,
        });

        io.emit('auction:notification', {
          type: 'success',
          message: `⏱ Time up! ${player.playerName} SOLD to ${team.teamName} for ${formatPrice(finalPrice)}!`,
        });

        state.currentPlayerId = null;
        state.currentBid = 0;
        state.highestBidderId = null;
        state.bidHistory = [];
        await state.save();

        await broadcastState(io);
        io.emit('team:squad_update');

      } else {
        // ── AUTO UNSOLD — no bids placed ──────────────────────────
        player.soldStatus = 'unsold';
        await player.save();

        state.auctionStatus = 'idle';
        state.currentPlayerId = null;
        state.currentBid = 0;
        state.highestBidderId = null;
        state.bidHistory = [];
        await state.save();

        await AuditLog.create({
          action: 'AUTO_UNSOLD',
          details: `Timer expired — No bids for ${player.playerName}. Marked UNSOLD.`,
          performedBy: 'SYSTEM',
        });

        io.emit('auction:sold_unsold', {
          status: 'unsold',
          playerName: player.playerName,
        });

        io.emit('auction:notification', {
          type: 'warning',
          message: `⏱ Time up! No bids — ${player.playerName} remains UNSOLD.`,
        });

        await broadcastState(io);
      }

    } catch (err) {
      console.error('[startTimer] Auto-sell error:', err);
      clearInterval(auctionTimer.timerInterval!);
      auctionTimer.timerInterval = null;
    }
  }, 1000);
};


// Helper to get list of unique teamCodes of active captain connections
export const getConnectedCaptains = (io: Server): string[] => {
  const connectedCaptains = new Set<string>();
  const sockets = io.sockets.sockets;
  sockets.forEach((s) => {
    if (s.data && s.data.role === 'captain' && s.data.teamCode) {
      connectedCaptains.add(s.data.teamCode);
    }
  });
  return Array.from(connectedCaptains);
};

export const registerAuctionHandlers = (io: Server, socket: Socket) => {
  // 1. Socket Authentication Handshake
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) {
    socket.disconnect(true);
    return;
  }

  jwt.verify(token, JWT_SECRET, async (err: any, decoded: any) => {
    if (err || !decoded) {
      socket.disconnect(true);
      return;
    }

    // Assign user data to socket connection
    socket.data.userId = decoded.id;
    socket.data.role = decoded.role;
    socket.data.teamCode = decoded.teamCode || null;

    console.log(`Connected client: ${socket.data.role} (${socket.data.teamCode || (decoded.role === 'viewer' ? 'Public Viewer' : 'Admin')}) [Socket: ${socket.id}]`);

    // Enforce single active device connection per franchise captain (skip for viewers)
    if (decoded.role === 'captain' && decoded.teamCode) {
      const activeSockets = await io.fetchSockets();
      for (const s of activeSockets) {
        if (s.id !== socket.id && s.data && s.data.role === 'captain' && s.data.teamCode === decoded.teamCode) {
          console.log(`Displacing duplicate captain connection for team: ${decoded.teamCode} (Socket: ${s.id})`);
          s.emit('auth:displaced');
          s.disconnect(true);
        }
      }
    }

    // Send initial state to this newly connected client
    await broadcastState(io);

    // Broadcast updated active captains list to everyone
    io.emit('auction:active_captains', getConnectedCaptains(io));

    // --- CAPTAIN ACTIONS ---
    socket.on('captain:place_bid', async (data: { bidAmount: number }) => {
      if (socket.data.role !== 'captain') {
        socket.emit('bid:error', { message: 'Only team captains can place bids' });
        return;
      }

      const teamId = socket.data.userId;
      const { bidAmount } = data;

      try {
        const state = await AuctionState.findOne();
        if (!state || state.auctionStatus !== 'active') {
          socket.emit('bid:error', { message: 'Auction is not active' });
          return;
        }

        if (!state.currentPlayerId) {
          socket.emit('bid:error', { message: 'No active player to bid on' });
          return;
        }

        const player = await Player.findById(state.currentPlayerId);
        if (!player) {
          socket.emit('bid:error', { message: 'Active player not found in database' });
          return;
        }

        const team = await Team.findById(teamId);
        if (!team) {
          socket.emit('bid:error', { message: 'Registered team not found' });
          return;
        }

        // VALIDATION ENGINE
        // A. Bid higher than current bid
        if (state.highestBidderId) {
          if (bidAmount <= state.currentBid) {
            socket.emit('bid:error', { message: `Bid must be greater than current bid: ${formatPrice(state.currentBid)}` });
            return;
          }
          // Check duplicate bidder (cannot bid against yourself)
          if (state.highestBidderId.toString() === teamId) {
            socket.emit('bid:error', { message: 'Your team already holds the highest bid' });
            return;
          }
        } else {
          // Opening bid must be at least base price
          if (bidAmount < player.basePrice) {
            socket.emit('bid:error', { message: `Opening bid must be at least the base price: ${formatPrice(player.basePrice)}` });
            return;
          }
        }

        // B. Sufficient purse available
        if (team.remainingPurse < bidAmount) {
          socket.emit('bid:error', { message: `Insufficient purse. Remaining: ${formatPrice(team.remainingPurse)}` });
          return;
        }

        // C. Team player limits (max 10 players)
        if (team.squadSize >= 10) {
          socket.emit('bid:error', { message: 'Your team squad is full (maximum 10 players reached)' });
          return;
        }

        // D. Prevent duplicate bid timestamp collisions
        const lastBid = state.bidHistory[state.bidHistory.length - 1];
        if (lastBid && lastBid.teamId.toString() === teamId && Date.now() - new Date(lastBid.timestamp).getTime() < 300) {
          socket.emit('bid:error', { message: 'Bid placing too fast. Rate limit exceeded.' });
          return;
        }

        // VALIDATION PASSED -> APPLY BID
        state.currentBid = bidAmount;
        state.highestBidderId = team._id as any;
        state.bidHistory.push({
          teamId: team._id as any,
          bidAmount,
          timestamp: new Date(),
        });

        await state.save();

        // Write to audit bids collection
        await Bid.create({
          playerId: player._id,
          teamId: team._id,
          bidAmount,
        });

        // Reset the timer countdown back to 15 seconds on every bid!
        auctionTimer.timerRemaining = 15;
        startTimer(io);

        // Notify all clients of new bid
        io.emit('auction:new_bid', {
          currentBid: state.currentBid,
          highestBidder: {
            _id: team._id,
            teamName: team.teamName,
            teamCode: team.teamCode,
            logo: team.logo,
          },
          bidFeedItem: {
            teamName: team.teamName,
            teamCode: team.teamCode,
            bidAmount,
            timestamp: new Date(),
          },
        });

        io.emit('auction:notification', {
          type: 'info',
          message: `${team.teamCode} placed a bid of ${formatPrice(bidAmount)} for ${player.playerName}`,
        });

        await broadcastState(io);

      } catch (error) {
        console.error('Bidding Error:', error);
        socket.emit('bid:error', { message: 'Server error processing bid' });
      }
    });

    // --- ADMIN ACTIONS ---
    socket.on('admin:start_auction', async (data: { playerId: string }) => {
      if (socket.data.role !== 'admin') {
        socket.emit('admin:error', { message: 'Unauthorized' });
        return;
      }

      try {
        const player = await Player.findById(data.playerId);
        if (!player) {
          socket.emit('admin:error', { message: 'Player not found' });
          return;
        }

        if (player.soldStatus === 'sold') {
          socket.emit('admin:error', { message: 'Player already sold' });
          return;
        }

        let state = await AuctionState.findOne();
        if (!state) {
          state = new AuctionState();
        }

        state.currentPlayerId = player._id as any;
        state.currentBid = 0; // Starts at 0, next bid must be >= basePrice
        state.highestBidderId = null;
        state.auctionStatus = 'active';
        state.bidHistory = [];

        await state.save();

        player.soldStatus = 'active';
        await player.save();

        await AuditLog.create({
          action: 'START_AUCTION',
          details: `Started auction for ${player.playerName} (Base Price: ${formatPrice(player.basePrice)})`,
          performedBy: 'ADMIN',
        });

        auctionTimer.timerRemaining = 15;
        startTimer(io);

        io.emit('auction:notification', {
          type: 'success',
          message: `Auction started for ${player.playerName}! Base Price: ${formatPrice(player.basePrice)}`,
        });

        await broadcastState(io);

      } catch (error) {
        console.error(error);
        socket.emit('admin:error', { message: 'Failed to start auction' });
      }
    });

    socket.on('admin:pause_auction', async () => {
      if (socket.data.role !== 'admin') return;

      try {
        const state = await AuctionState.findOne();
        if (state && state.auctionStatus === 'active') {
          state.auctionStatus = 'paused';
          await state.save();

          if (auctionTimer.timerInterval) {
            clearInterval(auctionTimer.timerInterval);
            auctionTimer.timerInterval = null;
          }

          io.emit('auction:notification', {
            type: 'warning',
            message: 'Auction paused by Administrator',
          });

          await broadcastState(io);
        }
      } catch (error) {
        console.error(error);
      }
    });

    socket.on('admin:resume_auction', async () => {
      if (socket.data.role !== 'admin') return;

      try {
        const state = await AuctionState.findOne();
        if (state && state.auctionStatus === 'paused') {
          state.auctionStatus = 'active';
          await state.save();

          startTimer(io);

          io.emit('auction:notification', {
            type: 'success',
            message: 'Auction resumed by Administrator',
          });

          await broadcastState(io);
        }
      } catch (error) {
        console.error(error);
      }
    });

    socket.on('admin:mark_sold', async () => {
      if (socket.data.role !== 'admin') return;

      try {
        const state = await AuctionState.findOne();
        if (!state || !state.currentPlayerId || !state.highestBidderId) {
          socket.emit('admin:error', { message: 'No bids placed yet or no active player' });
          return;
        }

        const player = await Player.findById(state.currentPlayerId);
        const team = await Team.findById(state.highestBidderId);

        if (!player || !team) {
          socket.emit('admin:error', { message: 'Player or team not found' });
          return;
        }

        // Finalize purchase
        const finalPrice = state.currentBid;
        team.remainingPurse -= finalPrice;
        team.squadSize += 1;
        await team.save();

        player.soldStatus = 'sold';
        player.soldPrice = finalPrice;
        player.soldTo = team._id as any;
        await player.save();

        // Clear timer
        if (auctionTimer.timerInterval) {
          clearInterval(auctionTimer.timerInterval);
          auctionTimer.timerInterval = null;
        }

        // Save state updates
        state.auctionStatus = 'idle';
        await state.save();

        await AuditLog.create({
          action: 'MARK_SOLD',
          details: `Sold ${player.playerName} to ${team.teamName} for ${formatPrice(finalPrice)}`,
          performedBy: 'ADMIN',
        });

        // Trigger confetti on frontend
        io.emit('auction:sold_unsold', {
          status: 'sold',
          playerName: player.playerName,
          teamName: team.teamName,
          teamCode: team.teamCode,
          logo: team.logo,
          price: finalPrice,
        });

        io.emit('auction:notification', {
          type: 'success',
          message: `SOLD! ${player.playerName} goes to ${team.teamName} for ${formatPrice(finalPrice)}!`,
        });

        // Reset active state
        state.currentPlayerId = null;
        state.currentBid = 0;
        state.highestBidderId = null;
        state.bidHistory = [];
        await state.save();

        await broadcastState(io);
        // Trigger squad & purse updates to all captains
        io.emit('team:squad_update');

      } catch (error) {
        console.error(error);
        socket.emit('admin:error', { message: 'Failed to mark player as sold' });
      }
    });

    socket.on('admin:mark_unsold', async () => {
      if (socket.data.role !== 'admin') return;

      try {
        const state = await AuctionState.findOne();
        if (!state || !state.currentPlayerId) {
          socket.emit('admin:error', { message: 'No active player' });
          return;
        }

        const player = await Player.findById(state.currentPlayerId);
        if (!player) return;

        player.soldStatus = 'unsold';
        await player.save();

        if (auctionTimer.timerInterval) {
          clearInterval(auctionTimer.timerInterval);
          auctionTimer.timerInterval = null;
        }

        state.auctionStatus = 'idle';
        await state.save();

        await AuditLog.create({
          action: 'MARK_UNSOLD',
          details: `Marked player ${player.playerName} as UNSOLD`,
          performedBy: 'ADMIN',
        });

        io.emit('auction:sold_unsold', {
          status: 'unsold',
          playerName: player.playerName,
        });

        io.emit('auction:notification', {
          type: 'warning',
          message: `${player.playerName} remains UNSOLD.`,
        });

        // Reset active state
        state.currentPlayerId = null;
        state.currentBid = 0;
        state.highestBidderId = null;
        state.bidHistory = [];
        await state.save();

        await broadcastState(io);

      } catch (error) {
        console.error(error);
        socket.emit('admin:error', { message: 'Failed to mark player as unsold' });
      }
    });

    socket.on('admin:reopen_player', async (data: { playerId: string }) => {
      if (socket.data.role !== 'admin') return;

      try {
        const player = await Player.findById(data.playerId);
        if (!player) return;

        // If player was previously sold, refund the team
        if (player.soldStatus === 'sold' && player.soldTo && player.soldPrice) {
          await Team.findByIdAndUpdate(player.soldTo, {
            $inc: { remainingPurse: player.soldPrice, squadSize: -1 }
          });
        }

        player.soldStatus = 'waiting';
        player.soldPrice = null;
        player.soldTo = null;
        await player.save();

        await AuditLog.create({
          action: 'REOPEN_PLAYER',
          details: `Reopened auction catalog for ${player.playerName}`,
          performedBy: 'ADMIN',
        });

        io.emit('auction:notification', {
          type: 'info',
          message: `${player.playerName} has been put back in the auction pool.`,
        });

        await broadcastState(io);
        io.emit('team:squad_update');

      } catch (error) {
        console.error(error);
      }
    });

    socket.on('admin:reset_auction', async () => {
      if (socket.data.role !== 'admin') {
        socket.emit('admin:error', { message: 'Unauthorized' });
        return;
      }

      try {
        // 1. Reset Auction State
        let state = await AuctionState.findOne();
        if (state) {
          state.currentPlayerId = null;
          state.currentBid = 0;
          state.highestBidderId = null;
          state.auctionStatus = 'idle';
          state.bidHistory = [];
          await state.save();
        }

        // 2. Clear timer
        if (auctionTimer.timerInterval) {
          clearInterval(auctionTimer.timerInterval);
          auctionTimer.timerInterval = null;
        }
        auctionTimer.timerRemaining = 15;

        // 3. Reset all players back to waiting
        await Player.updateMany({}, {
          soldStatus: 'waiting',
          soldPrice: null,
          soldTo: null
        });

        // 4. Reset all teams remaining purse to initial purse and squad size to 0
        const teams = await Team.find();
        for (const team of teams) {
          team.remainingPurse = team.initialPurse;
          team.squadSize = 0;
          await team.save();
        }

        // 5. Delete all recorded bids
        await Bid.deleteMany({});

        // 6. Log Audit
        await AuditLog.create({
          action: 'RESET_AUCTION',
          details: 'Wiped all bidding history and sales. Reset all team purses and player statuses back to waiting.',
          performedBy: 'ADMIN',
        });

        // 7. Notify all clients
        io.emit('auction:notification', {
          type: 'warning',
          message: 'The auction session has been fully reset by the administrator.',
        });

        // Broadcast updated state to everyone
        await broadcastState(io);
        
        // Trigger updates on captains
        io.emit('auction:sold_unsold', { status: 'reset' });

      } catch (error) {
        console.error(error);
        socket.emit('admin:error', { message: 'Failed to reset auction session' });
      }
    });

    // Disconnect handler
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      // Broadcast updated active captains list to everyone
      io.emit('auction:active_captains', getConnectedCaptains(io));
    });
  });
};
