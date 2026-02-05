Write-Host "=== SOLUCIONANDO DEPENDENCIAS FALTANTES ===" -ForegroundColor Green

# 1. Instalar dependencias faltantes
Write-Host "Instalando @nestjs/serve-static..." -ForegroundColor Yellow
npm install @nestjs/serve-static@4.0.2 serve-static@1.15.0 --save

# 2. Verificar e instalar otras dependencias comunes que puedan faltar
$commonMissing = @(
    "helmet",
    "joi", 
    "reflect-metadata",
    "@prisma/client"
)

Write-Host "Verificando dependencias comunes..." -ForegroundColor Cyan
foreach ($dep in $commonMissing) {
    try {
        npm list $dep --depth=0 | Out-Null
        Write-Host "  ✓ $dep instalado" -ForegroundColor Green
    } 
    catch {
        Write-Host "  ✗ $dep - instalando..." -ForegroundColor Yellow
        npm install $dep --save
    }
}

# 3. Verificar que Prisma esté configurado
if (Test-Path "prisma/schema.prisma") {
    Write-Host "Generando cliente Prisma..." -ForegroundColor Cyan
    npx prisma generate
} 
else {
    Write-Host "⚠ Advertencia: No se encontró schema.prisma" -ForegroundColor Red
}

Write-Host "`n✅ DEPENDENCIAS INSTALADAS" -ForegroundColor Green
Write-Host "`n🚀 Intenta iniciar el servidor:" -ForegroundColor Cyan
Write-Host "  npm run start:dev" -ForegroundColor White