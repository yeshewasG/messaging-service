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
  socket.on("join", (userId: string) => {
    console.log(userId);
    socket.join(userId);
  });
});

const redisSub = redis.duplicate();
redisSub.subscribe("socket_events");
redisSub.on("message", (_channel, message) => {
  console.log("event");

  const { receiverId, event, payload } = JSON.parse(message);
  console.log(message);

  io.to(receiverId).emit(event, payload);
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
