import http from 'http';
import { Server } from 'socket.io';
import app from './app';
import connectDB from './config/db';
import { registerAuctionHandlers } from './sockets/auctionHandler';
import AuctionState from './models/AuctionState';
import Team from './models/Team';

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Configure Socket.io server with lax CORS for multi-device live auction
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Setup socket listeners
io.on('connection', (socket) => {
  registerAuctionHandlers(io, socket);
});

// Initialize AuctionState document if empty
const initAuctionState = async () => {
  try {
    const count = await AuctionState.countDocuments();
    if (count === 0) {
      const state = new AuctionState({
        currentPlayerId: null,
        currentBid: 0,
        highestBidderId: null,
        auctionStatus: 'idle',
        timerDuration: 30,
        timerRemaining: 30,
        bidHistory: [],
      });
      await state.save();
      console.log('Initialized default auction state in database.');
    }
  } catch (error) {
    console.error('Error initializing auction state:', error);
  }
};

// Initialize default teams if empty
const initDefaultTeams = async () => {
  try {
    const count = await Team.countDocuments();
    if (count === 0) {
      const defaultTeams = [
        { teamName: 'Mumbai Titans', captainName: 'Hardik Pandya', mobileNumber: '9876543210', teamCode: 'TITANS', pin: '1111', initialPurse: 10000, remainingPurse: 10000, squadSize: 0 },
        { teamName: 'Chennai Kings', captainName: 'Ruturaj Gaikwad', mobileNumber: '9876543211', teamCode: 'KINGS', pin: '2222', initialPurse: 10000, remainingPurse: 10000, squadSize: 0 },
        { teamName: 'Royal Challengers', captainName: 'Faf du Plessis', mobileNumber: '9876543212', teamCode: 'RCB', pin: '3333', initialPurse: 10000, remainingPurse: 10000, squadSize: 0 },
        { teamName: 'Delhi Capitals', captainName: 'Rishabh Pant', mobileNumber: '9876543213', teamCode: 'DC', pin: '4444', initialPurse: 10000, remainingPurse: 10000, squadSize: 0 },
        { teamName: 'Kolkata Riders', captainName: 'Shreyas Iyer', mobileNumber: '9876543214', teamCode: 'KKR', pin: '5555', initialPurse: 10000, remainingPurse: 10000, squadSize: 0 },
      ];
      await Team.insertMany(defaultTeams);
      console.log('Seeded default teams successfully.');
    }
  } catch (error) {
    console.error('Error seeding default teams:', error);
  }
};

// Start application
const startServer = async () => {
  await connectDB();
  await initAuctionState();
  await initDefaultTeams();

  server.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(`🏏 Live Cricket Auction Server running on port ${PORT}`);
    console.log(`===================================================`);
  });
};

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
