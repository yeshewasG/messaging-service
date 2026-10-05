import { Request, Response } from "express";
import { prisma } from "../config/db";
import redis from "../services/redis.service";

export const sendSMS = async (req: Request, res: Response) => {
  try {
    const { senderId, receiverId, content, to } = req.body;

    if (!senderId || !receiverId || !content || !to) {
      return res.status(400).json({
        error: "Missing required fields: senderId, receiverId, content, to",
      });
    }

    // Store new message in PostgreSQL via Prisma
    const message = await prisma.message.create({
      data: {
        senderId: String(senderId),
        receiverId: String(receiverId),
        content: String(content),
        type: "sms",
        to: String(to),
        status: "queued",
        retryCount: 0,
      },
    });

    // Enqueue job to Redis
    await redis.lpush(
      "message_jobs",
      JSON.stringify({
        id: message.id,
        receiverId: message.receiverId,
        type: "sms",
        to: message.to,
        content: message.content,
      }),
    );

    return res.status(201).json({ status: "enqueued", message });
  } catch (error: any) {
    console.error("Error enqueuing SMS:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
};

export const sendEmail = async (req: Request, res: Response) => {
  try {
    const { senderId, receiverId, content, to, subject } = req.body;

    if (!senderId || !receiverId || !content || !to) {
      return res.status(400).json({
        error: "Missing required fields: senderId, receiverId, content, to",
      });
    }

    // Store new message in PostgreSQL via Prisma
    const message = await prisma.message.create({
      data: {
        senderId: String(senderId),
        receiverId: String(receiverId),
        content: String(content),
        type: "email",
        to: String(to),
        subject: subject ? String(subject) : undefined,
        status: "queued",
        retryCount: 0,
      },
    });

    // Enqueue job to Redis
    await redis.lpush(
      "message_jobs",
      JSON.stringify({
        id: message.id,
        receiverId: message.receiverId,
        type: "email",
        to: message.to,
        subject: message.subject,
        content: message.content,
      }),
    );

    return res.status(201).json({ status: "enqueued", message });
  } catch (error: any) {
    console.error("Error enqueuing Email:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
};
