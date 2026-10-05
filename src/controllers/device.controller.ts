import { Request, Response } from "express";
import { prisma } from "../config/db";

export const registerDevice = async (req: Request, res: Response) => {
  try {
    const { deviceId, name, platform } = req.body;

    if (!deviceId) {
      return res.status(400).json({ error: "Missing required field: deviceId" });
    }

    const device = await prisma.device.upsert({
      where: { deviceId: String(deviceId) },
      update: {
        name: name ? String(name) : undefined,
        platform: platform ? String(platform) : undefined,
      },
      create: {
        deviceId: String(deviceId),
        name: name ? String(name) : undefined,
        platform: platform ? String(platform) : undefined,
      },
    });

    return res.status(200).json({ status: "registered", device });
  } catch (error: any) {
    console.error("Error registering device:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
};
