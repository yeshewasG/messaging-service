import { Queue } from "bullmq";
import { connection } from "../config/redis";
import { MessageJob, MessageJobName } from "../types/message";

export const messageQueue = new Queue<MessageJob, void, MessageJobName>(
  "messages",
  {
    connection,
    defaultJobOptions: {
      attempts: 3, // Retry 3 times
      backoff: {
        type: "exponential",
        delay: 5000, // Wait 5s, then 10s, then 20s...
      },
      removeOnComplete: true, // Clean up Redis after success
    },
  },
);
