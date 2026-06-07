export interface Team {
  _id: string;
  teamName: string;
  captainName: string;
  mobileNumber: string;
  logo: string;
  initialPurse: number;
  remainingPurse: number;
  teamCode: string;
  pin: string;
  squadSize: number;
  createdAt: string;
  updatedAt: string;
}

export interface Player {
  _id: string;
  playerName: string;
  photo: string;
  age: number;
  role: 'Batsman' | 'Bowler' | 'All-Rounder' | 'Wicket-Keeper';
  battingStyle: string;
  bowlingStyle: string;
  basePrice: number;
  category: string;
  description: string;
  soldStatus: 'waiting' | 'active' | 'sold' | 'unsold';
  soldPrice: number | null;
  soldTo: {
    _id: string;
    teamName: string;
    teamCode: string;
    logo?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface BidHistoryItem {
  teamId: {
    _id: string;
    teamName: string;
    teamCode: string;
    logo?: string;
  };
  bidAmount: number;
  timestamp: string;
  _id: string;
}

export interface AuctionState {
  currentPlayerId: Player | null;
  currentBid: number;
  highestBidderId: {
    _id: string;
    teamName: string;
    teamCode: string;
    logo?: string;
    remainingPurse: number;
  } | null;
  auctionStatus: 'idle' | 'active' | 'paused' | 'completed';
  timerDuration: number;
  timerRemaining: number;
  bidHistory: BidHistoryItem[];
}

export interface User {
  id: string;
  role: 'admin' | 'captain';
  username?: string;
  teamCode?: string;
  teamName?: string;
  captainName?: string;
  logo?: string;
  purse?: number;
}

export interface BidFeedItem {
  teamName: string;
  teamCode: string;
  bidAmount: number;
  timestamp: string;
}
