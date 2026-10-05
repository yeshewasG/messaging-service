import Redis from "ioredis";

const redisHost = process.env.REDIS_HOST || "redis";
const redisPort = Number(process.env.REDIS_PORT) || 6379;

const redis = new Redis({
  host: redisHost,
  port: redisPort,
  retryStrategy: (times) => {
    // Reconnect backoff: 500ms, 1s, 2s, up to 5s max
    const delay = Math.min(times * 500, 5000);
    return delay;
  },
  maxRetriesPerRequest: null,
  enableOfflineQueue: true,
  reconnectOnError: () => true,
});

redis.on("connect", () => console.log("✅ Redis connected"));
redis.on("ready", () => console.log("🚀 Redis ready"));
redis.on("error", (err) => {
  console.warn("⚠️ Redis connection issue:", err.message);
});

export default redis;
