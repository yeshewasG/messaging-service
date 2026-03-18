import express from "express";
import http from "http"; // Required to wrap the express app
import { Server } from "socket.io";
import { createClient } from "redis";
import { createShardedAdapter } from "@socket.io/redis-adapter";
import dotenv from "dotenv";

import messageRoutes from "./routes/message.routes";
import { connectDB } from "./config/db";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { messageQueue } from "./queue/message.queue";

dotenv.config();

const app = express();
const httpServer = http.createServer(app); // 1. Create the HTTP server

// --- Socket.IO Setup with Redis Adapter ---
const pubClient = createClient({
  url: `redis://${process.env.REDIS_HOS}:${process.env.REDIS_PORT}`,
});

const subClient = pubClient.duplicate();

await Promise.all([pubClient.connect(), subClient.connect()]);

const io = new Server(httpServer, {
  // cors: {
  //   origin: "*", // Adjust this for production security
  // },
  adapter: createShardedAdapter(pubClient, subClient),
});

// --- Socket Connection Logic ---
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

// --- Middleware & Routes ---
app.use(express.json());

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [new BullMQAdapter(messageQueue)],
  serverAdapter: serverAdapter,
});

connectDB();

app.use("/api", messageRoutes);
app.use("/admin/queues", serverAdapter.getRouter());

// --- Start the Unified Server ---
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 BullBoard at http://localhost:${PORT}/admin/queues`);
});
