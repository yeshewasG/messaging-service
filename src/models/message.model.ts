import mongoose, { Schema, Document } from "mongoose";

export type MessageType = "sms" | "email";
export type MessageStatus = "queued" | "processing" | "sent" | "failed";

export interface IMessageJob extends Document {
  type: MessageType;
  to: string;
  subject?: string;
  content: string;
  status: MessageStatus;
  retryCount: number;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessageJob>(
  {
    type: { type: String, enum: ["sms", "email"], required: true },
    to: { type: String, required: true },
    subject: { type: String },
    content: { type: String, required: true },
    status: {
      type: String,
      enum: ["queued", "processing", "sent", "failed"],
      default: "queued",
    },
    retryCount: { type: Number, default: 0 },
    failureReason: { type: String },
  },
  {
    timestamps: true,
  },
);

export const MessageJobModel = mongoose.model<IMessageJob>(
  "MessageJob",
  messageSchema,
);
