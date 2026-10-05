import express from "express";
import http from "http";
import dotenv from "dotenv";
import messageRoutes from "./routes/message.routes";
import { connectDB } from "./config/db";
import { Server } from "socket.io";
import { setSocketServer } from "./socketEmitter";
import redis from "./services/redis.service";

dotenv.config();

const app = express();

app.use(express.json());
app.use("/api", messageRoutes);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

connectDB();

setSocketServer(io);

io.on("connection", (socket) => {
  console.log(`🔌 Socket client connected: ${socket.id}`);

  socket.on("join", (userId: string) => {
    if (userId) {
      console.log(`👤 Socket ${socket.id} joined room: ${userId}`);
      socket.join(userId);
    }
  });

  socket.on("disconnect", () => {
    console.log(`🔌 Socket client disconnected: ${socket.id}`);
  });
});

const redisSub = redis.duplicate();
redisSub.subscribe("socket_events");
redisSub.on("message", (_channel, message) => {
  try {
    const { receiverId, event, payload } = JSON.parse(message);
    if (receiverId && event) {
      io.to(receiverId).emit(event, payload);
      console.log(`📡 Emitted '${event}' event to room: ${receiverId}`);
    }
  } catch (err) {
    console.error("Error processing Redis socket_event:", err);
  }
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
