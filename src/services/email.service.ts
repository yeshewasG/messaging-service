import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const host = process.env.SMTP_HOST;
const port = Number(process.env.SMTP_PORT) || 587;
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465, // true for SSL, false for TLS
  auth: user && pass ? { user, pass } : undefined,
});

export async function sendEmail(to: string, subject?: string, content?: string) {
  if (!to || !to.trim()) {
    throw new Error("No recipients defined: 'to' field is empty or missing");
  }

  const senderName = process.env.SENDER_NAME || "Messaging Service";
  const senderEmail = user || "noreply@adeylab.com";
  const from = `"${senderName}" <${senderEmail}>`;

  return await transporter.sendMail({
    from,
    to: to.trim(),
    subject: subject || "Notification",
    text: content || "",
  });
}
