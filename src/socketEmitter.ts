import { Server } from "socket.io";

let io: Server | null = null;

export function setSocketServer(server: Server) {
  io = server;
}

export function emitToDevice(deviceId: string, event: string, payload: any) {
  if (!io) throw new Error("Socket server not initialized!");
  io.to(deviceId).emit(event, payload);
}
