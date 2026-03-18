import redis from "./redis.service";

// Simulate SMS send and publish a socket event
export async function sendSMS(to: string, content: string, receiverId: string) {
  console.log(`Sending SMS to ${to}: ${content} :${receiverId}`);

  // After sending, publish to Redis so web server can notify the client
  const event = {
    receiverId,
    event: "sms",
    payload: {
      to,
      content,
      timestamp: new Date(),
    },
  };

  await redis.publish("socket_events", JSON.stringify(event));
}
