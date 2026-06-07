import mongoose, { Schema, Document } from 'mongoose';

export interface ITeam extends Document {
  teamName: string;
  captainName: string;
  mobileNumber: string;
  logo: string; // Base64 or URL
  initialPurse: number;
  remainingPurse: number;
  teamCode: string;
  pin: string;
  squadSize: number;
  createdAt: Date;
  updatedAt: Date;
}

const TeamSchema: Schema = new Schema(
  {
    teamName: { type: String, required: true, unique: true, trim: true },
    captainName: { type: String, required: true, trim: true },
    mobileNumber: { type: String, required: true },
    logo: { type: String, default: '' },
    initialPurse: { type: Number, required: true, default: 100000000 }, // 10 Cr by default
    remainingPurse: { type: Number, required: true, default: 100000000 },
    teamCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    pin: { type: String, required: true }, // 4-digit code
    squadSize: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model<ITeam>('Team', TeamSchema);
