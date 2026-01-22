# Guía de Solución de Problemas - Sistema Interno MP

## 🔴 Errores Comunes y Soluciones

### Error: "Invalid login credentials" en producción

**Síntomas:**
- El login falla con el mensaje "Invalid login credentials" o "Credenciales inválidas"
- El error aparece en la consola del navegador como `AuthApiError: Invalid login credentials`

**Causas posibles:**

1. **Usuario no existe en Supabase:**
   - El usuario que intentas usar no ha sido creado en Supabase
   - Solución: Crea el usuario en Supabase Dashboard > Authentication > Users > Add User

2. **Variables de entorno incorrectas en Vercel:**
   - `VITE_SUPABASE_URL` o `VITE_SUPABASE_ANON_KEY` están incorrectas o faltantes
   - Solución: 
     - Ve a Vercel Dashboard > Tu Proyecto > Settings > Environment Variables
     - Verifica que `VITE_SUPABASE_URL` sea tu Project URL completa (ej: `https://xxxxx.supabase.co`)
     - Verifica que `VITE_SUPABASE_ANON_KEY` sea tu "Publishable key" (no el Service Role Key)
     - Haz un nuevo deploy después de cambiar las variables

3. **Credenciales incorrectas:**
   - El email o password que estás usando son incorrectos
   - Solución: Verifica las credenciales en Supabase Dashboard > Authentication > Users

**Pasos para crear un usuario en Supabase:**

1. Ve a [Supabase Dashboard](https://app.supabase.com)
2. Selecciona tu proyecto
3. Ve a **Authentication** > **Users**
4. Click en **Add User** > **Create new user**
5. Ingresa:
   - **Email**: El email que quieres usar para login
   - **Password**: Una contraseña segura
   - **Auto Confirm User**: Activa esta opción para que el usuario pueda iniciar sesión inmediatamente
6. Click en **Create User**
7. Ahora puedes usar estas credenciales para iniciar sesión en tu aplicación

**Verificar variables de entorno en Vercel:**

1. Ve a Vercel Dashboard > Tu Proyecto
2. Settings > Environment Variables
3. Verifica que existan:
   - `VITE_SUPABASE_URL` = `https://tu-proyecto.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = Tu "Publishable key" (no Service Role Key)
   - `VITE_API_URL` = `https://tu-backend.onrender.com`
4. Si cambiaste alguna variable, haz un nuevo deploy

**Nota importante:** 
- El "Publishable key" (anon key) es diferente del "Service Role Key"
- El frontend usa el "Publishable key"
- El backend usa el "Service Role Key"
- NO compartas el Service Role Key en el frontend (es un riesgo de seguridad)

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
