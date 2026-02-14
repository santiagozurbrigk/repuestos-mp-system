# Script para limpiar el historial de git y eliminar el commit con credenciales
# Ejecuta este script en PowerShell desde la carpeta del proyecto

Write-Host "Limpiando historial de git..." -ForegroundColor Yellow

# Verificar que estamos en el directorio correcto
if (-not (Test-Path ".git")) {
    Write-Host "Error: No se encontró el directorio .git. Asegúrate de estar en la raíz del proyecto." -ForegroundColor Red
    exit 1
}

# Eliminar archivos de lock si existen
if (Test-Path ".git/index.lock") {
    Remove-Item ".git/index.lock" -Force
    Write-Host "Archivo de lock eliminado" -ForegroundColor Green
}

# Ver commits actuales
Write-Host "`nCommits actuales:" -ForegroundColor Cyan
git log --oneline -5

# Resetear al commit anterior al problemático (8dfe402)
Write-Host "`nReseteando al commit 8dfe402..." -ForegroundColor Yellow
git reset --hard 8dfe402

# Aplicar cambios sin el archivo problemático
Write-Host "`nAplicando cambios limpios..." -ForegroundColor Yellow
git checkout c26c0ed -- .
git reset HEAD GOOGLE_CLOUD_ENV_EXAMPLE.txt 2>$null

# Verificar que el archivo no esté en staging
if (Test-Path "GOOGLE_CLOUD_ENV_EXAMPLE.txt") {
    Remove-Item "GOOGLE_CLOUD_ENV_EXAMPLE.txt" -Force
    Write-Host "Archivo GOOGLE_CLOUD_ENV_EXAMPLE.txt eliminado" -ForegroundColor Green
}

# Agregar todos los cambios excepto el archivo problemático
git add .
git reset HEAD GOOGLE_CLOUD_ENV_EXAMPLE.txt 2>$null

# Crear nuevo commit limpio
Write-Host "`nCreando nuevo commit limpio..." -ForegroundColor Yellow
git commit -m "feat: Implementar escaneo completo de facturas con Google Cloud Vision API

- Agregar botón y modal para escanear facturas completas
- Integrar Google Cloud Vision API para extracción automática de datos
- Agregar tabla de items de facturas
- Crear endpoints para procesar imágenes y gestionar items
- Actualizar documentación con guía de configuración de Google Cloud"

Write-Host "`n✅ Commit limpio creado exitosamente!" -ForegroundColor Green
Write-Host "`nAhora puedes hacer push con:" -ForegroundColor Cyan
Write-Host "git push origin main --force-with-lease" -ForegroundColor White
