import { prisma } from "../config/db";
import { sendSMS } from "../services/sms.service";
import { sendEmail } from "../services/email.service";
import redis from "../services/redis.service";
import "dotenv/config";

const QUEUE = "message_jobs";
const RETRY_LIMIT = 3;

async function processJob(job: any) {
  const { id, deviceId, to, content, subject, type } = job;

  if (!id) {
    console.error("Received job without an ID:", job);
    return;
  }

  let attempt = 1;

  try {
    const updated = await prisma.message.update({
      where: { id },
      data: {
        status: "processing",
        retryCount: { increment: 1 },
      },
    });
    attempt = updated.retryCount;

    if (type === "sms") {
      await sendSMS(to, content, deviceId);
    } else if (type === "email") {
      await sendEmail(to, subject, content);
    } else {
      throw new Error(`Unsupported message type: ${type}`);
    }

    await prisma.message.update({
      where: { id },
      data: {
        status: "sent",
        failureReason: null,
      },
    });
    console.log(`✅ Job ${id} (${type}) sent successfully.`);
  } catch (error: any) {
    const isFinalFailure = attempt >= RETRY_LIMIT;
    const failureReason = error?.message || "Unknown error";

    try {
      await prisma.message.update({
        where: { id },
        data: {
          status: isFinalFailure ? "failed" : "queued",
          failureReason,
        },
      });
    } catch (dbErr) {
      console.error(`Failed to update job status for ${id}:`, dbErr);
    }

    if (!isFinalFailure) {
      // Re-enqueue job
      await redis.lpush(QUEUE, JSON.stringify(job));
      console.log(`Job ${id} failed, re-enqueuing (attempt ${attempt}): ${failureReason}`);
    } else {
      console.error(`❌ Job ${id} permanently failed after ${RETRY_LIMIT} attempts: ${failureReason}`);
    }
  }
}

async function startWorker() {
  console.log(`🚀 Worker listening on queue: ${QUEUE}...`);
  while (true) {
    try {
      const arr = await redis.brpop(QUEUE, 0);
      if (!arr || !arr[1]) continue;
      const job = JSON.parse(arr[1]);
      await processJob(job);
    } catch (err) {
      console.error("Worker loop error:", err);
      await new Promise((r) => setTimeout(r, 1000)); // backoff
    }
  }
}

async function main() {
  try {
    await prisma.$connect();
    console.log("✅ Worker PostgreSQL (Prisma) ready");
    await startWorker();
  } catch (err) {
    console.error("Worker database connection error:", err);
    process.exit(1);
  }
}

main();
