// message.worker.ts
import { Worker } from "bullmq";
import mongoose from "mongoose"; // Add this
import { connection } from "../config/redis";
import { sendSMS } from "../services/sms.service";
import { sendEmail } from "../services/email.service";
import { MessageJobModel } from "../models/message.model";

const worker = new Worker(
  "messages",
  async (job) => {
    // 1. Safety Check: Ensure DB is connected
    if (mongoose.connection.readyState !== 1) {
      throw new Error("Database not connected yet. Retrying job...");
    }

    const { id, type, to, subject, content } = job.data;

    try {
      await MessageJobModel.findByIdAndUpdate(id, {
        status: "processing",
        $inc: { retryCount: 1 },
      });
      if (type === "sms") await sendSMS(to, content);
      if (type === "email") await sendEmail(to, subject!, content);

      await MessageJobModel.findByIdAndUpdate(id, { status: "sent" });
    } catch (error: any) {
      await MessageJobModel.findByIdAndUpdate(id, {
        status: job.attemptsMade >= 3 ? "failed" : "queued",
        failureReason: error?.message,
      });
      throw error;
    }
  },
  {
    connection,
    // Optional: Only start the worker when we tell it to
    autorun: false,
  },
);

// 2. Only run the worker once Mongoose is connected
mongoose.connection.once("open", () => {
  console.log("✅ MongoDB ready: Starting Worker...");
  worker.run();
});

export default worker;
