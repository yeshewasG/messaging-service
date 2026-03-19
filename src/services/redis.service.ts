import Redis from "ioredis";
const redis = new Redis({
  host: process.env.REDIS_HOST || "redis",
  port: Number(process.env.REDIS_PORT) || 6379,
  retryStrategy: (times) => {
    // reconnect after 2s, 5s, 10s...
    return Math.min(times * 2000, 10000);
  },
  maxRetriesPerRequest: null, // allow infinite retries
});
redis.on("connect", () => console.log("✅ Redis connected"));
redis.on("error", (err) => console.error("Redis error", err));
export default redis;
