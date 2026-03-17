import express from "express";
import dotenv from "dotenv";
import messageRoutes from "./routes/message.routes";
import "./workers/message.worker";
import { connectDB } from "./config/db";

import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { messageQueue } from "./queue/message.queue";

dotenv.config();

const app = express();

app.use(express.json());

// 1. Setup Bull Board Adapter
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [new BullMQAdapter(messageQueue)],
  serverAdapter: serverAdapter,
});

connectDB();

app.use("/api", messageRoutes);
app.use("/admin/queues", serverAdapter.getRouter()); // Dashboard UI

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
