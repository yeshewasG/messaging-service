# 📬 Messaging Service

A high-performance, asynchronous messaging service built with **Node.js**, **Express**, **TypeScript**, **PostgreSQL** (via **Prisma ORM**), **Redis**, and **Socket.IO**. It supports reliable SMS and Email dispatching with automatic retries, job queueing, and real-time client notifications.

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    Client[Client / External App] -->|POST /api/sms or /api/email| API[API Server Express]
    API -->|1. Save Message record status: queued| DB[(PostgreSQL)]
    API -->|2. Push Job| RedisQueue[(Redis Queue: message_jobs)]
    API -->|HTTP 201 enqueued| Client

    Worker[Background Worker] -->|3. BRPOP Job| RedisQueue
    Worker -->|4. Update status: processing| DB
    
    Worker -->|5a. Send SMS| SMSGateway[SMS Gateway]
    Worker -->|5b. Send Email| SMTPServer[SMTP Server]
    
    SMSGateway -->|Success| Worker
    SMTPServer -->|Success| Worker
    Worker -->|6. Update status: sent| DB
    Worker -->|7. Publish socket_events| RedisPubSub[(Redis Pub/Sub)]
    
    RedisPubSub -->|Subscribe| API
    API -->|8. Emit real-time notification| WebClient[Connected Socket.IO Clients]

    Worker -.->|On Failure attempt < 3| RedisQueue
    Worker -.->|On Failure attempt >= 3| DB
```

---

## ⚡ How It Works

1. **Request Ingestion**:
   - A client makes a `POST` request to `/api/sms` or `/api/email`.
   - The API validates fields (`senderId`, `receiverId`, `to`, `content`, `subject`).
   - The message is persisted in **PostgreSQL** with status `queued`.
   - A lightweight job payload (`{ id, receiverId, type, to, content, subject }`) is pushed to the Redis list `message_jobs`.
   - The API returns `201 Created` immediately with the queued message object.

2. **Asynchronous Job Processing**:
   - The **Background Worker** continuously listens to `message_jobs` using Redis `BRPOP`.
   - When a job arrives, the worker updates the message status to `processing` and increments `retryCount`.
   - For `sms`, the worker invokes `sendSMS()`.
   - For `email`, the worker invokes `sendEmail()` using Nodemailer.

3. **Retries & Error Handling**:
   - If an error occurs (e.g., SMTP timeout or network glitch), the worker catches the error.
   - If `retryCount < 3`, the worker updates status to `queued`, records `failureReason`, and re-enqueues the job into Redis.
   - If `retryCount >= 3`, the message is marked permanently as `failed` with the error reason stored in the database.

4. **Real-time Event Broadcasting**:
   - Upon successful dispatch (e.g., SMS sent), the worker publishes an event to the Redis `socket_events` channel.
   - The API server subscribes to `socket_events` and emits the event over Socket.IO to any client connected and joined to the room matching `receiverId`.

---

## 🔑 Key Concepts & Terminology

| Field | Meaning | Example |
| :--- | :--- | :--- |
| `senderId` | The ID, username, or UUID of the sender/system in your application. | `"user_101"`, `"auth-service"` |
| `receiverId` | The ID or UUID of the recipient user in your system (also used as their Socket.IO room). | `"user_202"` |
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

2. Push Prisma schema to your database:
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

### 1. Send SMS

**Endpoint**: `POST /api/sms`  
**Content-Type**: `application/json`

#### Request Payload:
```json
{
  "senderId": "auth_service",
  "receiverId": "user_101",
  "to": "+251912345678",
  "content": "Your Adey verification code is 492810. Valid for 5 minutes."
}
```

#### Example `curl`:
```bash
curl -X POST http://localhost:5000/api/sms \
  -H "Content-Type: application/json" \
  -d '{
    "senderId": "auth_service",
    "receiverId": "user_101",
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
    "senderId": "auth_service",
    "receiverId": "user_101",
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

### 2. Send Email

**Endpoint**: `POST /api/email`  
**Content-Type**: `application/json`

#### Request Payload:
```json
{
  "senderId": "billing_service",
  "receiverId": "user_202",
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
    "senderId": "billing_service",
    "receiverId": "user_202",
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
    "senderId": "billing_service",
    "receiverId": "user_202",
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

Clients can connect to the Socket.IO server to receive instant delivery notifications:

```javascript
import { io } from "socket.io-client";

const socket = io("http://localhost:5000");

// 1. Join room with your userId (matching receiverId)
socket.emit("join", "user_101");

// 2. Listen for SMS delivery events
socket.on("sms", (data) => {
  console.log("Realtime SMS notification received:", data);
  // data: { to: "+251912345678", content: "...", timestamp: "..." }
});
```

---

## 🚢 CI/CD & Deployment

A GitHub Actions workflow is preconfigured in [`.github/workflows/deploy.yml`](file:///.github/workflows/deploy.yml).

On every push to `main`:
1. Connects to your VPS via SSH.
2. Pulls the latest code (`git fetch` & `git reset --hard origin/main`).
3. Rebuilds and restarts the Dockerized services (`docker compose up -d --build`).
4. Prunes stale Docker images to conserve disk space.
