import mongoose from "mongoose";
import { sendSMS } from "../services/sms.service";
import MessageModel from "../models/message.model";
import redis from "../services/redis.service";
import "dotenv/config";
import { sendEmail } from "../services/email.service";

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI!)
  .then(() => {
    console.log("Worker MongoDB ready");
    startWorker();
  })
  .catch(console.error);

const QUEUE = "sms_jobs";
const RETRY_LIMIT = 3;

async function processJob(job: any) {
  const { id, receiverId, type, to, subject, content } = job.data;

  try {
    await MessageModel.findByIdAndUpdate(id, {
      status: "processing",
      $inc: { retryCount: 1 },
    });
    if (type === "sms") await sendSMS(to, content, receiverId);
    if (type === "email") await sendEmail(to, subject!, content);

    await MessageModel.findByIdAndUpdate(id, { status: "sent" });
  } catch (error: any) {
    const msg = await MessageModel.findById(id);
    const attempt = msg?.retryCount ?? 1;
    const failStatus = attempt >= RETRY_LIMIT ? "failed" : "queued";

    await MessageModel.findByIdAndUpdate(id, {
      status: failStatus,
      failureReason: error?.message,
    });
    if (attempt < RETRY_LIMIT) {
      // re-enqueue job
      await redis.lpush(QUEUE, JSON.stringify(job));
      console.log(`Job ${id} failed, re-enqueuing (attempt ${attempt}).`);
    } else {
      console.error(`Job ${id} failed after ${RETRY_LIMIT} attempts:`, error);
    }
  }
}

async function startWorker() {
  while (true) {
    try {
      const arr = await redis.brpop(QUEUE, 0);
      if (!arr || !arr[1]) continue;
      const job = JSON.parse(arr[1]);
      await processJob(job);
    } catch (err) {
      console.error("Worker error:", err);
      await new Promise((r) => setTimeout(r, 1000)); // backoff
    }
  }
}
