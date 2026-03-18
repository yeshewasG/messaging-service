import { ioEmitter } from "./socket.service";

export async function sendSMS(to: string, message: string) {
  ioEmitter.emit("sms", { to, content: message });
}
