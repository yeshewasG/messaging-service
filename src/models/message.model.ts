import mongoose, { Schema, Document } from "mongoose";

export interface IMessage extends Document {
  senderId: string;
  receiverId: string;
  content: string;
  type: "sms" | "email";
  to: string;
  subject?: string;
  status: string;
  retryCount: number;
  failureReason?: string;
  timestamp: Date;
}

const MessageSchema: Schema = new Schema({
  senderId: { type: String, required: true },
  receiverId: { type: String, required: true },
  content: { type: String, required: true },
  type: { type: String, required: true },
  to: { type: String, required: true },
  subject: { type: String },
  status: { type: String, default: "queued" },
  retryCount: { type: Number, default: 0 },
  failureReason: { type: String },
  timestamp: { type: Date, default: Date.now },
});

export default mongoose.model<IMessage>("Message", MessageSchema);
