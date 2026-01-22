# Guía de Solución de Problemas - Sistema Interno MP

## 🔴 Errores Comunes y Soluciones

### Error: CORS Policy Blocking Requests

**Síntomas:**
- Errores en consola: "Access to XMLHttpRequest... has been blocked by CORS policy"
- Las peticiones fallan con `ERR_FAILED` o `Network Error`

**Soluciones:**

1. **Verificar que el backend esté corriendo:**
   ```bash
   cd backend
   npm run dev
   ```
   Deberías ver: `🚀 Servidor corriendo en http://localhost:3001`

2. **Verificar variables de entorno:**
   - Asegúrate de que `backend/.env` tenga:
     ```
     CORS_ORIGIN=http://localhost:5173
     ```

3. **Reiniciar ambos servidores:**
   - Detén el backend (Ctrl+C)
   - Detén el frontend (Ctrl+C)
   - Inicia el backend primero
   - Luego inicia el frontend

4. **Verificar que el puerto del backend sea correcto:**
   - Backend debe estar en puerto 3001
   - Frontend debe estar en puerto 5173

### Error: 404 Not Found en rutas de API

**Síntomas:**
- Errores 404 en `/api/sales`, `/api/statistics`, etc.

**Soluciones:**

1. **Verificar que las rutas incluyan `/api`:**
   - El frontend ya está configurado para usar `/api` automáticamente
   - Si ves errores 404, verifica que el backend esté corriendo

2. **Verificar logs del backend:**
   - Deberías ver logs de cada request en la consola del backend
   - Si no ves logs, el backend no está recibiendo las peticiones

### Error: Token de Autenticación Inválido

**Síntomas:**
- Errores 401 (Unauthorized)
- Mensaje: "Token inválido o expirado"

**Soluciones:**

1. **Cerrar sesión y volver a iniciar:**
   - Haz clic en "Cerrar Sesión"
   - Inicia sesión nuevamente

2. **Verificar que Supabase esté funcionando:**
   - Ve a Supabase Dashboard
   - Verifica que tu proyecto esté activo

3. **Limpiar localStorage:**
   - Abre DevTools (F12)
   - Ve a Application > Local Storage
   - Limpia todo el storage
   - Recarga la página e inicia sesión nuevamente

### Error: Backend No Responde

**Síntomas:**
- Network Error
- "No se recibió respuesta del servidor"

**Soluciones:**

1. **Verificar que el backend esté corriendo:**
   ```bash
   # En otra terminal
   curl http://localhost:3001/health
   ```
   Deberías recibir: `{"status":"ok",...}`

2. **Verificar logs del backend:**
   - Busca errores en la consola del backend
   - Los errores aparecerán con el prefijo `[ERROR]`

3. **Verificar variables de entorno:**
   - Asegúrate de que `SUPABASE_URL` y `SUPABASE_SERVICE_KEY` sean correctos
   - El backend mostrará un error claro si faltan variables

### Error: Base de Datos (Supabase)

**Síntomas:**
- Errores relacionados con tablas no encontradas
- Errores de permisos

**Soluciones:**

1. **Ejecutar el schema SQL:**
   - Ve a Supabase Dashboard > SQL Editor
   - Copia y pega el contenido de `database/schema.sql`
   - Ejecuta el script

2. **Verificar políticas RLS:**
   - Las políticas están incluidas en el schema.sql
   - Si hay problemas, verifica que RLS esté habilitado

## 📊 Verificación del Sistema

### Checklist de Verificación

- [ ] Backend corriendo en puerto 3001
- [ ] Frontend corriendo en puerto 5173
- [ ] Variables de entorno configuradas en ambos
- [ ] Schema SQL ejecutado en Supabase
- [ ] Usuario creado en Supabase Auth
- [ ] Puedes iniciar sesión correctamente

### Comandos de Verificación

**Backend:**
```bash
cd backend
npm run dev
# Deberías ver: "🚀 Servidor corriendo en http://localhost:3001"
```

**Frontend:**
```bash
cd frontend
npm run dev
# Deberías ver: "Local: http://localhost:5173"
```

**Health Check:**
```bash
curl http://localhost:3001/health
# Deberías recibir: {"status":"ok",...}
```

## 🔍 Logs y Debugging

### Ver Logs del Backend

Los logs aparecen en la consola donde ejecutaste `npm run dev` en el backend. Busca:
- `[INFO]` - Información general
- `[SUCCESS]` - Operaciones exitosas
- `[WARN]` - Advertencias
- `[ERROR]` - Errores

### Ver Logs del Frontend

Los logs aparecen en la consola del navegador (F12 > Console). Busca:
- `[API] ℹ️` - Información de requests
- `[API] ✅` - Requests exitosos
- `[API] ⚠️` - Advertencias
- `[API] ❌` - Errores

## 🆘 Si Nada Funciona

1. **Detén todos los procesos:**
   - Cierra todas las terminales
   - Cierra el navegador completamente

2. **Limpia node_modules y reinstala:**
   ```bash
   # Backend
   cd backend
   rm -rf node_modules package-lock.json
   npm install
   
   # Frontend
   cd ../frontend
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Verifica las versiones de Node:**
   ```bash
   node --version  # Debe ser 18 o superior
   npm --version
   ```

4. **Revisa los logs detallados:**
   - Los logs ahora incluyen información detallada
   - Copia los mensajes de error completos
   - Busca en Google el error específico

## 📝 Notas Adicionales

- El sistema tiene logging completo habilitado
- Todos los errores se registran con contexto detallado
- Los errores de CORS ahora están mejor manejados
- Las peticiones OPTIONS (preflight) se manejan automáticamente
