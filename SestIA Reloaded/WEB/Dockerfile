
# --- Optimized Dockerfile for Railway ---
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dependencies only where needed
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Copy only necessary files
COPY . .

# Railway sets PORT env var automatically
ENV NODE_ENV=production

# Expose port (Railway uses $PORT)
EXPOSE 3000

# Start the app (listens on 0.0.0.0)
CMD ["node", "server.js"]
