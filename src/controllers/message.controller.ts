import { Request, Response } from "express";
import MessageModel from "../models/message.model";
import redis from "../services/redis.service";

export const sendSMS = async (req: Request, res: Response) => {
  const { senderId, receiverId, content, to, subject } = req.body;

  if (!senderId || !receiverId || !content || !to) {
    return res.status(400).json({ error: "Missing fields" });
  }

  // Store new message/job in DB
  const message = await MessageModel.create({
    senderId,
    receiverId,
    content,
    type: "sms",
    to,
    status: "queued",
    retryCount: 0,
  });

  await redis.lpush(
    "sms_jobs",
    JSON.stringify({ receiverId, id: message._id, type: "sms", to, content }),
  );

  return res.json({ status: "enqueued", message });
};

export const sendEmail = async (req: Request, res: Response) => {
  const { senderId, receiverId, content, to, subject } = req.body;

  if (!senderId || !receiverId || !content || !to) {
    return res.status(400).json({ error: "Missing fields" });
  }

  // Store new message/job in DB
  const message = await MessageModel.create({
    senderId,
    receiverId,
    content,
    type: "email",
    to,
    subject,
    status: "queued",
    retryCount: 0,
  });

  await redis.lpush(
    "message_jobs",
    JSON.stringify({
      receiverId,
      id: message._id,
      type: "email",
      to,
      subject,
      content,
    }),
  );

  return res.json({ status: "enqueued", message });
};
