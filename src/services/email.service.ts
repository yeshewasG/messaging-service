import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: Number(process.env.SMTP_PORT) === 465, // true for SSL, false for TLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  // logger: true, // logs SMTP commands
  // debug: true, // prints connection info
});

export async function sendEmail(to: string, subject: string, content: string) {
  await transporter.sendMail({
    from: `${process.env.SENDER_NAME} <${process.env.SMTP_USER}>`,
    to,
    subject,
    text: content,
  });
}
