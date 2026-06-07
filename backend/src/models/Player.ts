import mongoose, { Schema, Document } from 'mongoose';

export interface IPlayer extends Document {
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
  soldTo: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const PlayerSchema: Schema = new Schema(
  {
    playerName: { type: String, required: true, trim: true },
    photo: { type: String, default: '' },
    age: { type: Number, required: true },
    role: {
      type: String,
      required: true,
      enum: ['Batsman', 'Bowler', 'All-Rounder', 'Wicket-Keeper'],
    },
    battingStyle: { type: String, default: '' },
    bowlingStyle: { type: String, default: '' },
    basePrice: { type: Number, required: true },
    category: { type: String, default: 'Uncapped' },
    description: { type: String, default: '' },
    soldStatus: {
      type: String,
      required: true,
      enum: ['waiting', 'active', 'sold', 'unsold'],
      default: 'waiting',
    },
    soldPrice: { type: Number, default: null },
    soldTo: { type: Schema.Types.ObjectId, ref: 'Team', default: null },
  },
  { timestamps: true }
);

export default mongoose.model<IPlayer>('Player', PlayerSchema);
