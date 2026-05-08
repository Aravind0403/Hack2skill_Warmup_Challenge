# Stage 1: Build the frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm test
RUN npm run build

# Stage 2: Build the backend and serve the application
FROM node:20-alpine
WORKDIR /app

# Copy backend files and install as root
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --production
COPY backend/ .

# Copy built frontend assets from stage 1
COPY --from=frontend-builder /app/frontend/dist ../frontend/dist

# Create a non-root user and fix permissions
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /app
USER appuser

# Expose port 8080 for Cloud Run
EXPOSE 8080

ENV PORT=8080
ENV NODE_ENV=production

# Start the server
CMD ["node", "server.js"]
