# Runtime container for backend (NestJS) located in ./backend
# Build and run with Node 20 on Alpine
FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
COPY backend/package*.json backend/tsconfig*.json backend/prisma ./backend/
RUN cd backend && npm ci

# Copy source
COPY backend/src ./backend/src
COPY backend/prisma ./backend/prisma

# Build
RUN cd backend && npm run build

# Expose port used by Nest (configurable via PORT env)
EXPOSE 3000

# Start application
CMD ["node", "backend/dist/main"]
