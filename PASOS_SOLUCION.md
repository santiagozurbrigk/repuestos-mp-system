# Pasos para Resolver el Problema de Git - Guía Paso a Paso

## 🎯 Objetivo
Eliminar el commit con credenciales y hacer push exitosamente.

---

## Paso 1: Limpiar el Estado de Git

Abre PowerShell o Git Bash en la carpeta del proyecto y ejecuta:

```bash
# Eliminar archivos de rebase si existen
Remove-Item -Recurse -Force .git/rebase-merge -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .git/rebase-apply -ErrorAction SilentlyContinue

# Verificar estado
git status
```

**Resultado esperado:** Deberías ver "On branch main" sin mensajes de rebase.

---

## Paso 2: Verificar los Commits Actuales

```bash
git log --oneline -5
```

**Deberías ver:**
- `c26c0ed` (commit limpio)
- `3a3d727` (commit problemático - este hay que eliminar)
- `8dfe402` (commit anterior)

---

## Paso 3: Eliminar el Commit Problemático

Ejecuta:

```bash
git rebase -i 8dfe402
```

**Se abrirá un editor** (probablemente Notepad o Vim). Verás algo como:

```
pick 3a3d727 feat: Implementar escaneo...
pick c26c0ed feat: Implementar escaneo...
```

**En el editor:**
1. Encuentra la línea con `pick 3a3d727`
2. Cambia `pick` por `drop` (o simplemente elimina toda la línea)
3. Deja la línea con `pick c26c0ed` como está
4. Guarda el archivo y cierra el editor

**Si usas Notepad:** Guarda con Ctrl+S y cierra
**Si usas Vim:** Presiona `i` para editar, haz los cambios, presiona `Esc`, luego escribe `:wq` y Enter

---

## Paso 4: Verificar que el Commit se Eliminó

```bash
git log --oneline -5
```

**Resultado esperado:** Ya NO deberías ver el commit `3a3d727`. Solo deberías ver:
- `c26c0ed` (commit limpio)
- `8dfe402` (commit anterior)

---

## Paso 5: Hacer Push

```bash
git push origin main --force-with-lease
```

**Si aún aparece el error de secret:**
- Ve al enlace: https://github.com/santiagozurbrigk/repuestos-mp-system/security/secret-scanning/unblock-secret/39DwoS5oz0rCNu7twvLTrMuqwPG
- Haz clic en "Allow secret"
- Vuelve a ejecutar: `git push origin main --force-with-lease`

---

## Paso 6: Verificar que Funcionó

```bash
git log --oneline -3
```

Deberías ver que el push fue exitoso y el commit problemático ya no está.

---

## ⚠️ IMPORTANTE: Rotar Credenciales

Después de hacer push exitosamente, **DEBES rotar las credenciales de Google Cloud** porque estuvieron expuestas:

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Ve a **IAM & Admin** → **Service Accounts**
3. Encuentra la cuenta `vision-api-service2@repuestos-mp-486422.iam.gserviceaccount.com`
4. Ve a la pestaña **"Claves"**
5. Elimina la clave actual (la que está en el commit)
6. Crea una nueva clave JSON
7. Actualiza las variables en Render con las nuevas credenciales

---

## 🆘 Si Algo Sale Mal

Si tienes problemas en cualquier paso:

1. **Abortar rebase:**
   ```bash
   git rebase --abort
   ```

2. **Volver al estado original:**
   ```bash
   git reset --hard origin/main
   ```

3. **Usar la solución rápida:**
   - Ve al enlace de GitHub y permite el secret
   - Haz push normalmente

---

## ✅ Checklist Final

- [ ] Estado de git limpio (sin rebase en progreso)
- [ ] Commit problemático eliminado del historial
- [ ] Push exitoso a GitHub
- [ ] Credenciales de Google Cloud rotadas
- [ ] Variables actualizadas en Render
