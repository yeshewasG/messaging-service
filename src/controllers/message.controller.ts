import { Request, Response } from "express";
import { MessageJobModel } from "../models/message.model";
import { messageQueue } from "../queue/message.queue";
import { sendEmail as mail } from "../services/email.service";

export const sendSMS = async (req: Request, res: Response) => {
  const { to, message, subject } = req.body;

  const job = await MessageJobModel.create({
    type: "sms",
    to,
    subject,
    content: message,
    status: "queued",
  });

  await messageQueue.add("send", {
    id: job._id.toString(),
    type: "sms",
    to,
    content: message,
  });

  res.json({ success: true, id: job._id });
};

export const sendEmail = async (req: Request, res: Response) => {
  const { to, subject, message } = req.body;

  const job = await MessageJobModel.create({
    type: "email",
    to,
    subject,
    content: message,
    status: "queued",
  });

  await messageQueue.add("send", {
    id: job._id.toString(),
    type: "email",
    to,
    subject,
    content: message,
  });

  res.json({ success: true, id: job._id });
};
