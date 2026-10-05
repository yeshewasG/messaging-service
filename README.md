# 📬 Messaging Service

A high-performance, asynchronous messaging service built with **Node.js**, **Express**, **TypeScript**, **PostgreSQL** (via **Prisma ORM**), **Redis**, and **Socket.IO**. It supports reliable SMS and Email dispatching with automatic retries, job queueing, and real-time client notifications.

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    GatewayDevice[Gateway App] -->|0. POST /api/devices/register, then socket join: deviceId| API[API Server Express]
    Client[Client / External App] -->|POST /api/sms or /api/email, deviceId + to + content| API
    API -->|1. Save Message record status: queued, FK to Device| DB[(PostgreSQL)]
    API -->|2. Push Job| RedisQueue[(Redis Queue: message_jobs)]
    API -->|HTTP 201 enqueued| Client

    Worker[Background Worker] -->|3. BRPOP Job| RedisQueue
    Worker -->|4. Update status: processing| DB

    Worker -->|5a. type sms: publish socket_events deviceId, event, payload| RedisPubSub[(Redis Pub/Sub)]
    RedisPubSub -->|Subscribe| API
    API -->|6a. Emit to Socket.IO room = deviceId| GatewayDevice
    GatewayDevice -->|7a. Actually sends the SMS natively| Carrier[Phone's SIM / SMS carrier]

    Worker -->|5b. type email: send directly| SMTPServer[SMTP Server]

    Worker -.->|On Failure attempt < 3| RedisQueue
    Worker -.->|On Failure attempt >= 3| DB
```

> **Note:** `deviceId` is required on every message for schema consistency, but it is only actually used to route **SMS** jobs to the gateway app over its socket room. **Email** is sent directly via SMTP from the worker and does not involve any device.

---

## ⚡ How It Works

0. **Device Registration**:
   - A gateway app (e.g. an Android phone running the SMS-sending app) generates a stable `deviceId` on first launch and persists it locally.
   - On every launch, it calls `POST /api/devices/register` to upsert its `Device` row, then connects over Socket.IO and emits `join` with its `deviceId`, joining a room of that name.
   - The server tracks presence on that `Device` row (`socketId`, `isOnline`, `lastSeenAt`) as sockets connect/disconnect.

1. **Request Ingestion**:
   - A client makes a `POST` request to `/api/sms` or `/api/email`.
   - The API validates fields (`deviceId`, `to`, `content`, `subject`).
   - The message is persisted in **PostgreSQL** with status `queued`, with a foreign key to the `Device` identified by `deviceId`.
   - A lightweight job payload (`{ id, deviceId, type, to, content, subject }`) is pushed to the Redis list `message_jobs`.
   - The API returns `201 Created` immediately with the queued message object.

2. **Asynchronous Job Processing**:
   - The **Background Worker** continuously listens to `message_jobs` using Redis `BRPOP`.
   - When a job arrives, the worker updates the message status to `processing` and increments `retryCount`.
   - For `sms`, the worker relays the job to the target device (see below).
   - For `email`, the worker invokes `sendEmail()` directly using Nodemailer — no device involved.

3. **Retries & Error Handling**:
   - If an error occurs (e.g., SMTP timeout or network glitch), the worker catches the error.
   - If `retryCount < 3`, the worker updates status to `queued`, records `failureReason`, and re-enqueues the job into Redis.
   - If `retryCount >= 3`, the message is marked permanently as `failed` with the error reason stored in the database.

4. **Real-time Device Delivery (SMS only)**:
   - For `sms` jobs, the worker publishes an event (`{ deviceId, event: "sms", payload }`) to the Redis `socket_events` channel.
   - The API server subscribes to `socket_events` and emits the event over Socket.IO to the room matching `deviceId` — i.e. the specific gateway device that should actually send the SMS from its own SIM.

---

## 🔑 Key Concepts & Terminology

| Field | Meaning | Example |
| :--- | :--- | :--- |
| `deviceId` | Stable id generated and persisted by a gateway device on first launch. Used both as its Socket.IO room name and as the FK on `Message` identifying which device should deliver an `sms` job. | `"3f1b2a7e-9c4d-4a2b-8e5f-1234567890ab"` |
| `Device` | A registered gateway app instance (`deviceId`, `socketId`, `isOnline`, `lastSeenAt`). Upserted via `POST /api/devices/register` and kept in sync on socket join/disconnect. | — |
| `to` | The actual destination target (phone number for SMS, email address for Email). | `"+251912345678"`, `"alex@example.com"` |
| `content` | The message body or text. | `"Your verification code is 492810"` |
| `subject` | Optional subject line (for emails). | `"Welcome to Adey Lab"` |
| `SENDER_NAME` | The brand or organization name displayed to the recipient. | `"Adey Lab"` |

---

## 🚀 Getting Started with Docker (Recommended)

The entire stack (**PostgreSQL**, **Redis**, **API**, and **Worker**) is Dockerized and starts with one command.

### 1. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Ensure [`.env`](file:///.env) contains your desired configuration:

```env
PORT=5000
REDIS_HOST=redis
REDIS_PORT=6379

POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=messaging_db
POSTGRES_PORT=5432
DATABASE_URL="postgresql://postgres:postgres@postgres:5432/messaging_db?schema=public"

SENDER_NAME="Adey Lab"
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### 2. Start Services

```bash
docker compose up -d --build
```

This starts:
- **`postgres_messaging`**: PostgreSQL 16 Alpine with healthcheck.
- **`redis_messaging`**: Redis 7 Alpine with healthcheck.
- **`messaging_api`**: Express server & Socket.IO (automatically runs Prisma schema sync on boot).
- **`messaging_worker`**: Background queue worker processing SMS and Emails.

### 3. Check Container Status & Logs

```bash
# View running containers
docker compose ps

# View API logs
docker logs -f messaging_api

# View Worker logs
docker logs -f messaging_worker
```

### 4. Stop Services

```bash
docker compose down
```

---

## 🛠️ Local Development (Without Docker)

### Prerequisites
- Node.js 20+
- Running PostgreSQL database instance
- Running Redis instance

### Installation & Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Push Prisma schema to your database (creates the `devices` table and the `Message.deviceId` FK):
   ```bash
   npm run prisma:push
   ```

3. Run both API and Worker simultaneously:
   ```bash
   npm run dev
   ```

   Or run them in separate terminals:
   ```bash
   npm run dev:server  # API Server on port 5000
   npm run dev:worker  # Queue Worker
   ```

---

## 📡 API Reference

### 1. Register a Device

**Endpoint**: `POST /api/devices/register`
**Content-Type**: `application/json`

Call this once per app launch (upserts by `deviceId`). `name`/`platform` are optional.

#### Request Payload:
```json
{
  "deviceId": "3f1b2a7e-9c4d-4a2b-8e5f-1234567890ab",
  "platform": "android"
}
```

#### Example `curl`:
```bash
curl -X POST http://localhost:5000/api/devices/register \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "3f1b2a7e-9c4d-4a2b-8e5f-1234567890ab",
    "platform": "android"
  }'
```

#### Success Response (`200 OK`):
```json
{
  "status": "registered",
  "device": {
    "id": "a1b2c3d4-e5f6-4789-9abc-def012345678",
    "deviceId": "3f1b2a7e-9c4d-4a2b-8e5f-1234567890ab",
    "name": null,
    "platform": "android",
    "socketId": null,
    "isOnline": false,
    "lastSeenAt": null,
    "createdAt": "2026-10-05T11:30:00.000Z",
    "updatedAt": "2026-10-05T11:30:00.000Z"
  }
}
```

---

### 2. Send SMS

**Endpoint**: `POST /api/sms`  
**Content-Type**: `application/json`

`deviceId` identifies the registered gateway device that should actually send this SMS from its SIM.

#### Request Payload:
```json
{
  "deviceId": "3f1b2a7e-9c4d-4a2b-8e5f-1234567890ab",
  "to": "+251912345678",
  "content": "Your Adey verification code is 492810. Valid for 5 minutes."
}
```

#### Example `curl`:
```bash
curl -X POST http://localhost:5000/api/sms \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "3f1b2a7e-9c4d-4a2b-8e5f-1234567890ab",
    "to": "+251912345678",
    "content": "Your Adey verification code is 492810. Valid for 5 minutes."
  }'
```

#### Success Response (`201 Created`):
```json
{
  "status": "enqueued",
  "message": {
    "id": "b3f07a01-499c-4822-ba78-294025ad512d",
    "deviceId": "3f1b2a7e-9c4d-4a2b-8e5f-1234567890ab",
    "content": "Your Adey verification code is 492810. Valid for 5 minutes.",
    "type": "sms",
    "to": "+251912345678",
    "subject": null,
    "status": "queued",
    "retryCount": 0,
    "failureReason": null,
    "createdAt": "2026-10-05T11:30:00.000Z",
    "updatedAt": "2026-10-05T11:30:00.000Z"
  }
}
```

---

### 3. Send Email

**Endpoint**: `POST /api/email`  
**Content-Type**: `application/json`

Email is sent directly via SMTP and never reaches a device, but `deviceId` is still required for schema consistency — use any already-registered device id, or a fixed placeholder id for a service account if you don't have a real gateway device for email.

#### Request Payload:
```json
{
  "deviceId": "3f1b2a7e-9c4d-4a2b-8e5f-1234567890ab",
  "to": "client@example.com",
  "subject": "Monthly Statement - March 2026",
  "content": "Hi Alex, your statement is now available for download."
}
```

#### Example `curl`:
```bash
curl -X POST http://localhost:5000/api/email \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "3f1b2a7e-9c4d-4a2b-8e5f-1234567890ab",
    "to": "client@example.com",
    "subject": "Monthly Statement - March 2026",
    "content": "Hi Alex, your statement is now available for download."
  }'
```

#### Success Response (`201 Created`):
```json
{
  "status": "enqueued",
  "message": {
    "id": "e4a112cd-8890-48e2-9db8-1d2239ad512e",
    "deviceId": "3f1b2a7e-9c4d-4a2b-8e5f-1234567890ab",
    "content": "Hi Alex, your statement is now available for download.",
    "type": "email",
    "to": "client@example.com",
    "subject": "Monthly Statement - March 2026",
    "status": "queued",
    "retryCount": 0,
    "failureReason": null,
    "createdAt": "2026-10-05T11:30:00.000Z",
    "updatedAt": "2026-10-05T11:30:00.000Z"
  }
}
```

---

## 🔌 Real-Time WebSocket Integration (Socket.IO)

This is how a gateway device receives `sms` jobs addressed to it. The `deviceId` used to join must be the same one registered via `POST /api/devices/register` and the same one sent as `deviceId` when queuing an SMS job.

```javascript
import { io } from "socket.io-client";

const socket = io("http://localhost:5000");

// 1. Join the room matching this device's deviceId
socket.emit("join", "3f1b2a7e-9c4d-4a2b-8e5f-1234567890ab");

// 2. Listen for SMS jobs addressed to this device
socket.on("sms", (data) => {
  console.log("SMS job received:", data);
  // data: { to: "+251912345678", content: "...", timestamp: "..." }
  // The device is expected to actually send the SMS from its own SIM.
});
```

Device presence (`isOnline`, `socketId`, `lastSeenAt` on the `Device` row) is updated automatically as this socket connects and disconnects.

---

## 🚢 CI/CD & Deployment

A GitHub Actions workflow is preconfigured in [`.github/workflows/deploy.yml`](file:///.github/workflows/deploy.yml).

On every push to `main`:
1. Connects to your VPS via SSH.
2. Pulls the latest code (`git fetch` & `git reset --hard origin/main`).
3. Rebuilds and restarts the Dockerized services (`docker compose up -d --build`).
4. Prunes stale Docker images to conserve disk space.
