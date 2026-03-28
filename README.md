\# Sistema de Inventario - Casa Renta



Sistema contable para administración de inventario con múltiples centros de costo y clientes.



\## Características



\- ✅ Gestión completa de inventario

\- ✅ Múltiples centros de costo

\- ✅ Gestión de clientes

\- ✅ Movimientos de entrada y salida

\- ✅ Control de stock mínimo

\- ✅ Múltiples unidades de medida

\- ✅ Sistema de reportes

\- ✅ Autenticación JWT

\- ✅ Interfaz web responsive



\## Instalación



\### 1. Requisitos

\- Node.js 18+

\- PostgreSQL 12+

\- npm o yarn



\### 2. Backend

```bash

cd backend

npm install

npx prisma generate

npx prisma migrate dev --name init

npm run start:dev

## Despliegue en Railway (backend)

1. Variables de entorno requeridas:
   - `DATABASE_URL` (PostgreSQL gestionado por Railway)
   - `JWT_SECRET`
   - `JWT_EXPIRATION` (ej. `24h`)
   - `PORT` (Railway inyecta `PORT`; no sobreescribir)
   - `NODE_ENV=production`
   - `FRONTEND_URL` (URL de Vercel)
   - `UPLOAD_PATH` (opcional, por defecto `./uploads`)
2. Conecta el repo y selecciona el directorio `backend` como raíz del servicio.
3. Railway detecta `railway.json` y usa Nixpacks. Construcción automática:
   - `npm ci`
   - `npm run build`
   - `prisma generate` (hook `postinstall`)
4. Comando de arranque: `npm run start:prod`. Healthcheck: `/api/health`.
5. Ejecuta `npx prisma migrate deploy` desde la pestaña “Shell” tras crear la base de datos.

## Despliegue en Vercel (frontend)

1. Crear proyecto apuntando a la carpeta `frontend` como root.
2. No requiere build; se sirve como sitio estático.
3. El archivo `vercel.json` define:
   - Rewrite `/api/*` → backend en Railway.
   - Rewrite `/uploads/*` → archivos estáticos del backend.
4. En producción el frontend usará `/api` automáticamente; en local sigue apuntando a `http://localhost:3000/api`.

