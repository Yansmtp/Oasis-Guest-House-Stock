# install.ps1 - Instalación automática
param(
    [string]$dbPassword = "password",
    [string]$dbHost = "",
    [string]$dbPort = "5432",
    [string]$dbName = "inventario_db",
    [string]$adminEmail = "admin@empresa.com",
    [string]$adminPassword = "Admin123!",
    [string]$adminName = "Administrador"
)

$ErrorActionPreference = "Stop"
$currentPath = Get-Location

Write-Host "=== INSTALACIÓN AUTOMÁTICA ===" -ForegroundColor Cyan
Write-Host "Este script instalará todas las dependencias y configurará la base de datos" -ForegroundColor Yellow

# 1. Configurar backend
Write-Host "`n1. Configurando Backend..." -ForegroundColor Green
Set-Location "D:\inventario-casa-renta\backend"

# Crear .env
$envContent = @"
# Database
DATABASE_URL="D:\inventario-casa-renta\scripts"

# JWT
JWT_SECRET="inventario-secret-key-change-in-production-$(Get-Random -Minimum 100000 -Maximum 999999)"

# Server
PORT=3000
NODE_ENV=development

# App
APP_NAME="Sistema de Inventario Casa Renta"
"@

Write-Host "✓ Archivo .env creado" -ForegroundColor Green
$envContent | Out-File -FilePath "D:\inventario-casa-renta\backend\.env" -Encoding UTF8

# Instalar dependencias
Write-Host "Instalando dependencias de Node.js..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Error instalando dependencias" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Dependencias instaladas" -ForegroundColor Green

# Generar cliente Prisma
Write-Host "   Generando cliente Prisma..." -ForegroundColor Yellow
npx prisma generate
Write-Host "✓ Cliente Prisma generado" -ForegroundColor Green

# 2. Configurar frontend
Write-Host "`n2. Configurando Frontend..." -ForegroundColor Green
Set-Location "$currentPath\frontend"

# Crear imágenes por defecto (placeholders)
$logoContent = [Convert]::FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAgSURBVHgB7cEBAQAAAIIg/69uSEABAAAAAAAAAAAAAAAAAADg9gG6qgABgN3QIQAAAABJRU5ErkJggg==")
[IO.File]::WriteAllBytes("$currentPath\frontend\img\logo.png", $logoContent)
Write-Host "✓ Logo placeholder creado" -ForegroundColor Green

# 3. Crear scripts de utilidad
Write-Host "`n3. Creando scripts de utilidad..." -ForegroundColor Green
Set-Location "D:\inventario-casa-renta\scripts"

# Script para crear usuario admin
$adminScript = @"
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createAdminUser() {
  try {
    // Verificar si ya existe el usuario
    const existingUser = await prisma.user.findUnique({
      where: { email: '$adminEmail' }
    });

    if (existingUser) {
      console.log('⚠️  El usuario administrador ya existe');
      console.log('   Email: $adminEmail');
      return;
    }

    const hashedPassword = await bcrypt.hash('$adminPassword', 10);
    
    const adminUser = await prisma.user.create({
      data: {
        email: '$adminEmail',
        password: hashedPassword,
        name: '$adminName',
        role: 'ADMIN',
        isActive: true
      }
    });
    
    console.log('✅ USUARIO ADMINISTRADOR CREADO');
    console.log('===============================');
    console.log('Email: $adminEmail');
    console.log('Contraseña: $adminPassword');
    console.log('Nombre: $adminName');
    console.log('Rol: ADMIN');
    console.log('');
    console.log('⚠️  IMPORTANTE: Cambia la contraseña después del primer acceso');
    
  } catch (error) {
    console.error('❌ Error creando usuario:', error.message);
    console.error('Asegúrate que:');
    console.error('1. PostgreSQL esté corriendo en $dbHost:$dbPort');
    console.error('2. La base de datos "$dbName" exista');
    console.error('3. Las credenciales sean correctas');
  } finally {
    await prisma.\$disconnect();
  }
}

createAdminUser();
"@

$adminScript | Out-File -FilePath "create-admin.js" -Encoding UTF8
Write-Host "   ✓ Script create-admin.js creado" -ForegroundColor Green

# Script de inicio
$startScript = @"
@echo off
echo ========================================
echo    SISTEMA DE INVENTARIO - CASA RENTA
echo ========================================
echo.
echo 1. Iniciando PostgreSQL...
echo    (Asegúrate que PostgreSQL esté corriendo)
echo.
echo 2. Iniciando Backend API...
start cmd /k "cd /d "$currentPath\backend" && npm run start:dev"
echo.
echo 3. Abriendo Frontend...
start "" "D:\inventario-casa-renta\frontend\index.html"
echo.
echo 4. Creando usuario administrador...
cd /d "$currentPath\backend" && node ../scripts/create-admin.js
echo.
echo ========================================
echo    ACCESO AL SISTEMA:
echo    Email: $adminEmail
echo    URL: D:\inventario-casa-renta\frontend\index.html
echo    Contraseña: $adminPassword
echo ========================================
pause
"@

$startScript | Out-File -FilePath "start-system.bat" -Encoding ASCII
Write-Host "   ✓ Script start-system.bat creado" -ForegroundColor Green

Write-Host "`n✅ INSTALACIÓN COMPLETADA" -ForegroundColor Cyan
Write-Host "`nPasos siguientes:" -ForegroundColor Yellow
Write-Host "1. Asegúrate que PostgreSQL esté corriendo" -ForegroundColor White
Write-Host "2. Ejecuta: .\scripts\start-system.bat" -ForegroundColor White
Write-Host "3. Accede al sistema con:" -ForegroundColor White
Write-Host "   Email: $adminEmail" -ForegroundColor Green
Write-Host "   Contraseña: $adminPassword" -ForegroundColor Green