import { Emitter } from "@socket.io/redis-emitter";
import { createClient } from "redis";

const redisClient = createClient({
  url: `redis://${process.env.REDIS_HOS}:${process.env.REDIS_PORT}`,
});

export const ioEmitter = new Emitter(redisClient);
