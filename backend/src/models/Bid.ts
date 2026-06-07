import mongoose, { Schema, Document } from 'mongoose';

export interface IBid extends Document {
  playerId: mongoose.Types.ObjectId;
  teamId: mongoose.Types.ObjectId;
  bidAmount: number;
  timestamp: Date;
}

const BidSchema: Schema = new Schema({
  playerId: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
  teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
  bidAmount: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
});

export default mongoose.model<IBid>('Bid', BidSchema);
