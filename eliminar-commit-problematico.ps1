# Script para eliminar el commit problemático del historial
# Ejecuta este script en PowerShell desde la carpeta del proyecto

Write-Host "Eliminando commit problemático del historial..." -ForegroundColor Yellow

# Verificar que estamos en el directorio correcto
if (-not (Test-Path ".git")) {
    Write-Host "Error: No se encontró el directorio .git" -ForegroundColor Red
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

Write-Host "`nIniciando rebase interactivo..." -ForegroundColor Yellow
Write-Host "En el editor que se abra, cambia 'pick' por 'drop' en el commit 3a3d727" -ForegroundColor Yellow
Write-Host "O simplemente elimina la línea completa del commit 3a3d727" -ForegroundColor Yellow
Write-Host "Guarda y cierra el editor" -ForegroundColor Yellow

# Iniciar rebase interactivo
$env:GIT_EDITOR = "notepad"
git rebase -i 8dfe402

Write-Host "`nRebase completado. Verificando historial..." -ForegroundColor Green
git log --oneline -5

Write-Host "`n✅ Si el commit 3a3d727 ya no aparece, puedes hacer push:" -ForegroundColor Green
Write-Host "git push origin main --force-with-lease" -ForegroundColor White
