# Guía de Deploy - Sistema Interno MP

Esta guía te ayudará a desplegar el sistema en Vercel (frontend) y Render (backend).

## 📋 Prerrequisitos

1. Cuenta en [Supabase](https://supabase.com)
2. Cuenta en [Vercel](https://vercel.com)
3. Cuenta en [Render](https://render.com)
4. Git repository (GitHub, GitLab, etc.)

## 🗄️ Configuración de Supabase

### 1. Crear proyecto en Supabase

1. Ve a [Supabase Dashboard](https://app.supabase.com)
2. Crea un nuevo proyecto
3. Anota las siguientes credenciales:
   - Project URL
   - Anon Key
   - Service Role Key (en Settings > API)

### 2. Ejecutar el esquema de base de datos

1. Ve a SQL Editor en Supabase
2. Copia y pega el contenido de `database/schema.sql`
3. Ejecuta el script
4. Verifica que las tablas se hayan creado correctamente

### 3. Configurar autenticación

1. Ve a Authentication > Settings
2. Configura las opciones de autenticación según tus necesidades
3. Crea usuarios de prueba desde Authentication > Users

## 🚀 Deploy del Backend (Render)

### 1. Preparar el repositorio

```bash
# Asegúrate de que todos los cambios estén commiteados
git add .
git commit -m "Preparar para deploy"
git push origin main
```

### 2. Crear servicio en Render

1. Ve a [Render Dashboard](https://dashboard.render.com)
2. Click en "New +" > "Web Service"
3. Conecta tu repositorio de Git
4. Configura el servicio:
   - **Name**: sistema-interno-mp-backend
   - **Environment**: Node
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   
   **⚠️ IMPORTANTE**: Si configuras `Root Directory` como `backend`, NO incluyas `cd backend` en los comandos. Render ya ejecutará los comandos dentro de ese directorio.

### 3. Configurar variables de entorno en Render

En la sección "Environment Variables" del servicio, agrega:

```
NODE_ENV=production
PORT=3001
SUPABASE_URL=tu_supabase_url
SUPABASE_SERVICE_KEY=tu_supabase_service_key
CORS_ORIGIN=https://tu-frontend.vercel.app
```

**Nota**: Reemplaza `tu_supabase_url`, `tu_supabase_service_key` y `tu-frontend.vercel.app` con tus valores reales.

### 4. Deploy

1. Click en "Create Web Service"
2. Render comenzará a construir y desplegar tu aplicación
3. Anota la URL del servicio (ej: `https://sistema-interno-mp-backend.onrender.com`)

## 🎨 Deploy del Frontend (Vercel)

### 1. Preparar el proyecto

Asegúrate de que el archivo `frontend/.env` tenga las variables correctas (no lo subas a Git, solo para referencia local).

### 2. Crear proyecto en Vercel

1. Ve a [Vercel Dashboard](https://vercel.com/dashboard)
2. Click en "Add New..." > "Project"
3. Importa tu repositorio de Git
4. Configura el proyecto:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

### 3. Configurar variables de entorno en Vercel

En la sección "Environment Variables", agrega:

```
VITE_SUPABASE_URL=tu_supabase_url
VITE_SUPABASE_ANON_KEY=tu_supabase_anon_key
VITE_API_URL=https://tu-backend.onrender.com
```

**Nota**: Reemplaza los valores con tus URLs reales.

### 4. Deploy

1. Click en "Deploy"
2. Vercel construirá y desplegará tu aplicación
3. Anota la URL del proyecto (ej: `https://sistema-interno-mp.vercel.app`)

### 5. Actualizar CORS en Render

Una vez que tengas la URL de Vercel, actualiza la variable `CORS_ORIGIN` en Render con la URL completa de tu frontend.

## ✅ Verificación Post-Deploy

### Backend

1. Visita `https://tu-backend.onrender.com/health`
2. Deberías ver: `{"status":"ok","timestamp":"..."}`

### Frontend

1. Visita tu URL de Vercel
2. Deberías ver la página de login
3. Intenta iniciar sesión con un usuario creado en Supabase

## 🔧 Troubleshooting

### Backend no responde

- Verifica que las variables de entorno estén correctamente configuradas
- Revisa los logs en Render Dashboard
- Asegúrate de que el puerto sea el correcto (Render asigna automáticamente)

### Frontend no puede conectar con el backend

- Verifica que `VITE_API_URL` apunte a la URL correcta del backend
- Revisa la configuración de CORS en el backend
- Verifica que el backend esté funcionando visitando `/health`

### Errores de autenticación

**Error: "Invalid login credentials"**

Este error significa que las credenciales no son válidas. Verifica:

1. **Usuario existe en Supabase:**
   - Ve a Supabase Dashboard > Authentication > Users
   - Si no hay usuarios, crea uno con "Add User" > "Create new user"
   - Asegúrate de activar "Auto Confirm User" para que pueda iniciar sesión inmediatamente

2. **Variables de entorno en Vercel:**
   - Verifica que `VITE_SUPABASE_URL` sea tu Project URL completa
   - Verifica que `VITE_SUPABASE_ANON_KEY` sea tu "Publishable key" (NO el Service Role Key)
   - Haz un nuevo deploy después de cambiar variables

3. **Credenciales correctas:**
   - Usa el email y password exactos del usuario creado en Supabase
   - Verifica que no haya espacios o caracteres especiales incorrectos

**Nota:** El "Publishable key" (anon key) es diferente del "Service Role Key". El frontend usa el Publishable key.

## 📝 Notas Adicionales

- Render puede tardar unos minutos en iniciar el servicio si está inactivo (free tier)
- Vercel hace deploy automático en cada push a la rama principal
- Considera usar un dominio personalizado para producción
- Mantén las variables de entorno seguras y no las compartas públicamente
