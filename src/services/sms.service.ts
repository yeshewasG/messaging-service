import redis from "./redis.service";

// Relay the send request to the device (over the gateway app's socket) and publish a socket event
export async function sendSMS(to: string, content: string, deviceId: string) {
  console.log(`Relaying SMS to device ${deviceId}: ${to} - ${content}`);

  // Publish to Redis so the web server can notify the target device's socket
  const event = {
    deviceId,
    event: "sms",
    payload: {
      to,
      content,
      timestamp: new Date(),
    },
  };

  await redis.publish("socket_events", JSON.stringify(event));
}
