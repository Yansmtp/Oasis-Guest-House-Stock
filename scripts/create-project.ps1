#!/usr/bin/env pwsh

Write-Host "🚀 Creando proyecto de Inventario Casa Renta..." -ForegroundColor Green

# Crear estructura de directorios
$directories = @(
    "backend/src/auth",
    "backend/src/auth/dto",
    "backend/src/products",
    "backend/src/products/dto",
    "backend/src/clients",
    "backend/src/clients/dto",
    "backend/src/cost-centers",
    "backend/src/cost-centers/dto",
    "backend/src/movements",
    "backend/src/movements/dto",
    "backend/src/reports",
    "backend/src/company",
    "backend/src/company/dto",
    "backend/src/shared/prisma",
    "backend/src/shared/guards",
    "backend/prisma/migrations",
    "backend/uploads/logos",
    "frontend/css",
    "frontend/js",
    "frontend/img",
    "frontend/templates",
    "scripts",
    "docs"
)

foreach ($dir in $directories) {
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "✓ Creado: $dir" -ForegroundColor Cyan
    }
}

Write-Host "`n📁 Estructura de directorios creada exitosamente" -ForegroundColor Green
Write-Host "`n📋 Siguientes pasos:" -ForegroundColor Yellow
Write-Host "1. Configura PostgreSQL y actualiza DATABASE_URL en backend/.env"
Write-Host "2. Ejecuta 'npm install' en la carpeta backend"
Write-Host "3. Ejecuta 'npx prisma migrate dev' para crear la base de datos"
Write-Host "4. Ejecuta 'npm run start:dev' para iniciar el backend"
Write-Host "5. Abre frontend/index.html en tu navegador"
Write-Host "`n🎉 ¡Listo para comenzar!" -ForegroundColor Green