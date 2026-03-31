# Runtime container for backend (NestJS) located in ./backend
# Build and run with Node 20 on Alpine
FROM node:20-alpine AS base
WORKDIR /app

# Copiar archivos de configuración y dependencias al raíz del contenedor
COPY backend/package*.json backend/tsconfig*.json backend/nest-cli.json* ./
COPY backend/prisma ./prisma/
RUN npm ci

# Copiar el código fuente del backend
COPY backend ./

# Compilar la aplicación (genera el directorio dist)
RUN npm run build

# Expose port used by Nest (configurable via PORT env)
EXPOSE 3000

# Start application
# Ejecuta las migraciones de Prisma antes de iniciar la aplicación
CMD npx prisma migrate deploy && node dist/main
