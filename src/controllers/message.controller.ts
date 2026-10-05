import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/db";
import redis from "../services/redis.service";
import { validateCommonFields, PHONE_REGEX, EMAIL_REGEX } from "../utils/validation";

function isForeignKeyViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003"
  );
}

export const sendSMS = async (req: Request, res: Response) => {
  try {
    const fieldError = validateCommonFields(req.body);
    if (fieldError) {
      return res.status(400).json({ error: fieldError });
    }

    const { deviceId, content, to } = req.body;

    if (!PHONE_REGEX.test(String(to).trim())) {
      return res.status(400).json({ error: "'to' must be a valid phone number" });
    }

    const device = await prisma.device.findUnique({
      where: { deviceId: String(deviceId) },
    });
    if (!device) {
      return res.status(404).json({
        error: `Device '${deviceId}' is not registered. Register it via POST /api/devices/register first.`,
      });
    }

    // Store new message in PostgreSQL via Prisma
    const message = await prisma.message.create({
      data: {
        deviceId: String(deviceId),
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
        deviceId: message.deviceId,
        type: "sms",
        to: message.to,
        content: message.content,
      }),
    );

    return res.status(201).json({ status: "enqueued", message });
  } catch (error: any) {
    console.error("Error enqueuing SMS:", error);
    if (isForeignKeyViolation(error)) {
      return res.status(404).json({ error: "Device is not registered." });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const sendEmail = async (req: Request, res: Response) => {
  try {
    const fieldError = validateCommonFields(req.body);
    if (fieldError) {
      return res.status(400).json({ error: fieldError });
    }

    const { deviceId, content, to, subject } = req.body;

    if (!EMAIL_REGEX.test(String(to).trim())) {
      return res.status(400).json({ error: "'to' must be a valid email address" });
    }
    if (subject !== undefined && typeof subject !== "string") {
      return res.status(400).json({ error: "subject must be a string" });
    }

    const device = await prisma.device.findUnique({
      where: { deviceId: String(deviceId) },
    });
    if (!device) {
      return res.status(404).json({
        error: `Device '${deviceId}' is not registered. Register it via POST /api/devices/register first.`,
      });
    }

    // Store new message in PostgreSQL via Prisma
    const message = await prisma.message.create({
      data: {
        deviceId: String(deviceId),
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
        deviceId: message.deviceId,
        type: "email",
        to: message.to,
        subject: message.subject,
        content: message.content,
      }),
    );

    return res.status(201).json({ status: "enqueued", message });
  } catch (error: any) {
    console.error("Error enqueuing Email:", error);
    if (isForeignKeyViolation(error)) {
      return res.status(404).json({ error: "Device is not registered." });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
};
