import axios from "axios";

export async function sendSMS(to: string, message: string) {
  await axios.post("https://api.africastalking.com/version1/messaging", {
    to,
    message,
  });
}
