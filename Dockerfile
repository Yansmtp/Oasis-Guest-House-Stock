# Runtime container for backend (NestJS) located in ./backend
# Build and run with Node 20 on Alpine
FROM node:20-alpine AS base
WORKDIR /app

# Copiar configuración y dependencias
COPY backend/package*.json backend/tsconfig*.json backend/nest-cli.json* ./backend/
COPY backend/prisma ./backend/prisma
RUN cd backend && npm ci

# Copiar el resto del código fuente del backend
COPY backend ./backend

# Build
RUN cd backend && npm run build

# Set working directory for the application
WORKDIR /app/backend

# Expose port used by Nest (configurable via PORT env)
EXPOSE 3000

# Start application
CMD ["node", "dist/main"]
