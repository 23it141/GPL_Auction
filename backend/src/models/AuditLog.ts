import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  action: string;
  details: string;
  performedBy: string;
  timestamp: Date;
}

const AuditLogSchema: Schema = new Schema({
  action: { type: String, required: true },
  details: { type: String, required: true },
  performedBy: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

export default mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
