# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and prisma schema
COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

# Copy source and config
COPY . .

# Build the project (generates prisma client and dist/)
RUN npm run build

# Stage 2: Run
FROM node:20-alpine AS runner

WORKDIR /app

# Copy package files and prisma schema
COPY package*.json ./
COPY prisma ./prisma/

# Install production dependencies
RUN npm install --omit=dev

# Copy generated Prisma engine and client from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Copy compiled JS from builder
COPY --from=builder /app/dist ./dist

# Standardize port
EXPOSE 5000

# Default command: ensure database schema is pushed, then start server
CMD ["sh", "-c", "npx prisma db push --skip-generate && npm start"]