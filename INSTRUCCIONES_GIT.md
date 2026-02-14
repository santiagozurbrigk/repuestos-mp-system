# Instrucciones para Limpiar el Historial de Git

GitHub está bloqueando el push porque el commit `3a3d727` contiene credenciales de Google Cloud.

## Opción 1: Ejecutar el Script Automático (Recomendado)

1. **Cierra cualquier aplicación que esté usando git** (VS Code, Git GUI, etc.)
2. Abre PowerShell en la carpeta del proyecto
3. Ejecuta:
   ```powershell
   .\fix-git-history.ps1
   ```
4. Si el script funciona, ejecuta:
   ```powershell
   git push origin main --force-with-lease
   ```

## Opción 2: Hacerlo Manualmente

Si el script no funciona debido a permisos, hazlo manualmente:

1. **Cierra todas las aplicaciones que usen git** (VS Code, Git GUI, etc.)

2. Abre Git Bash o PowerShell en la carpeta del proyecto

3. Resetea al commit anterior:
   ```bash
   git reset --hard 8dfe402
   ```

4. Aplica los cambios del commit limpio (sin el archivo problemático):
   ```bash
   git checkout c26c0ed -- .
   git reset HEAD GOOGLE_CLOUD_ENV_EXAMPLE.txt
   ```

5. Elimina el archivo si existe:
   ```bash
   rm GOOGLE_CLOUD_ENV_EXAMPLE.txt
   ```

6. Agrega todos los cambios:
   ```bash
   git add .
   ```

7. Crea un nuevo commit:
   ```bash
   git commit -m "feat: Implementar escaneo completo de facturas con Google Cloud Vision API"
   ```

8. Haz push:
   ```bash
   git push origin main --force-with-lease
   ```

## Opción 3: Usar el Enlace de GitHub (Más Rápido)

Si prefieres una solución rápida:

1. Ve a este enlace y permite temporalmente el secret:
   https://github.com/santiagozurbrigk/repuestos-mp-system/security/secret-scanning/unblock-secret/39DwoS5oz0rCNu7twvLTrMuqwPG

2. Luego ejecuta:
   ```bash
   git push origin main
   ```

**⚠️ IMPORTANTE:** Después de hacer push, deberías rotar las credenciales de Google Cloud por seguridad, ya que estuvieron expuestas en el historial de git.

## Verificar que Funcionó

Después del push, verifica que:
- Los cambios están en GitHub
- El botón "Escanear Factura Completa" aparece en la página de Proveedores
- Vercel y Render hacen el deploy automáticamente
