# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
RUN npm install

# Copy source and config
COPY . .

# Build the project (generates /dist)
RUN npm run build

# Stage 2: Run
FROM node:20-alpine AS runner

WORKDIR /app

# Only copy production dependencies to keep the image small
COPY package*.json ./
RUN npm install --omit=dev

# Copy the compiled JS from the builder stage
COPY --from=builder /app/dist ./dist

# Standardize port
EXPOSE 5000

# Default command (will be overridden in docker-compose)
CMD ["npm", "start"]