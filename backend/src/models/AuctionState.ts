import mongoose, { Schema, Document } from 'mongoose';

export interface IBidHistory {
  teamId: mongoose.Types.ObjectId;
  bidAmount: number;
  timestamp: Date;
}

export interface IAuctionState extends Document {
  currentPlayerId: mongoose.Types.ObjectId | null;
  currentBid: number;
  highestBidderId: mongoose.Types.ObjectId | null;
  auctionStatus: 'idle' | 'active' | 'paused' | 'completed';
  timerDuration: number;
  timerRemaining: number;
  bidHistory: IBidHistory[];
  updatedAt: Date;
}

const BidHistorySchema: Schema = new Schema({
  teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
  bidAmount: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
});

const AuctionStateSchema: Schema = new Schema(
  {
    currentPlayerId: { type: Schema.Types.ObjectId, ref: 'Player', default: null },
    currentBid: { type: Number, default: 0 },
    highestBidderId: { type: Schema.Types.ObjectId, ref: 'Team', default: null },
    auctionStatus: {
      type: String,
      required: true,
      enum: ['idle', 'active', 'paused', 'completed'],
      default: 'idle',
    },
    timerDuration: { type: Number, default: 15 },
    timerRemaining: { type: Number, default: 15 },
    bidHistory: { type: [BidHistorySchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model<IAuctionState>('AuctionState', AuctionStateSchema);
