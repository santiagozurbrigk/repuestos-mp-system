# Solución Rápida para el Problema de Git

El commit `3a3d727` contiene credenciales y GitHub lo está bloqueando.

## ✅ SOLUCIÓN MÁS RÁPIDA (Recomendada)

**Usa el enlace de GitHub para permitir temporalmente el secret:**

1. Abre este enlace en tu navegador:
   **https://github.com/santiagozurbrigk/repuestos-mp-system/security/secret-scanning/unblock-secret/39DwoS5oz0rCNu7twvLTrMuqwPG**

2. Haz clic en **"Allow secret"** o **"Permitir secret"**

3. Luego ejecuta en tu terminal:
   ```bash
   git push origin main --force-with-lease
   ```

4. **IMPORTANTE:** Después del push, rota las credenciales de Google Cloud:
   - Ve a Google Cloud Console → Service Accounts
   - Elimina la clave actual
   - Crea una nueva clave JSON
   - Actualiza las variables en Render con las nuevas credenciales

## 🔧 Alternativa: Eliminar el Commit del Historial

Si prefieres eliminar el commit completamente:

### Paso 1: Abortar cualquier rebase en progreso
```bash
git rebase --abort
```

### Paso 2: Eliminar el commit problemático
```bash
git rebase -i 8dfe402
```

En el editor que se abra:
- Encuentra la línea con `pick 3a3d727`
- Cámbiala a `drop 3a3d727` (o simplemente elimina la línea)
- Guarda y cierra

### Paso 3: Si hay conflictos, resuélvelos y continúa
```bash
git rebase --continue
```

### Paso 4: Hacer push
```bash
git push origin main --force-with-lease
```

## ⚠️ Nota de Seguridad

Las credenciales que están en el commit `3a3d727` están expuestas. Aunque elimines el commit del historial, si alguien ya clonó el repositorio antes, podría tener acceso. Por eso es **MUY IMPORTANTE** rotar las credenciales después de resolver esto.
