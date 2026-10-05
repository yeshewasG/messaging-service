import express from "express";
import http from "http";
import dotenv from "dotenv";
import messageRoutes from "./routes/message.routes";
import deviceRoutes from "./routes/device.routes";
import { connectDB, prisma } from "./config/db";
import { Server } from "socket.io";
import { setSocketServer } from "./socketEmitter";
import redis from "./services/redis.service";

dotenv.config();

const app = express();

app.use(express.json());
app.use("/api", messageRoutes);
app.use("/api/devices", deviceRoutes);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

connectDB();

setSocketServer(io);

io.on("connection", (socket) => {
  console.log(`🔌 Socket client connected: ${socket.id}`);

  socket.on("join", async (deviceId: string) => {
    if (!deviceId) return;

    console.log(`📱 Socket ${socket.id} joined room: ${deviceId}`);
    socket.join(deviceId);

    try {
      await prisma.device.upsert({
        where: { deviceId },
        update: { socketId: socket.id, isOnline: true, lastSeenAt: new Date() },
        create: { deviceId, socketId: socket.id, isOnline: true, lastSeenAt: new Date() },
      });
    } catch (err) {
      console.error(`Failed to mark device ${deviceId} online:`, err);
    }
  });

  socket.on("disconnect", async () => {
    console.log(`🔌 Socket client disconnected: ${socket.id}`);

    try {
      await prisma.device.updateMany({
        where: { socketId: socket.id },
        data: { isOnline: false, socketId: null, lastSeenAt: new Date() },
      });
    } catch (err) {
      console.error(`Failed to mark socket ${socket.id} offline:`, err);
    }
  });
});

const redisSub = redis.duplicate();
redisSub.subscribe("socket_events");
redisSub.on("message", (_channel, message) => {
  try {
    const { deviceId, event, payload } = JSON.parse(message);
    if (deviceId && event) {
      io.to(deviceId).emit(event, payload);
      console.log(`📡 Emitted '${event}' event to room: ${deviceId}`);
    }
  } catch (err) {
    console.error("Error processing Redis socket_event:", err);
  }
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
