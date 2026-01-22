# Guía de Producción - Sistema Interno MP

## ✅ Preparación Completada

El proyecto ha sido preparado para producción con las siguientes optimizaciones:

### 🔇 Logging Optimizado

- **Frontend**: Los logs de desarrollo (`info`, `success`) solo se muestran en modo desarrollo. En producción solo se registran errores y warnings.
- **Backend**: Los logs de desarrollo están deshabilitados en producción. Solo se registran errores críticos y warnings importantes.

### 📦 Archivos de Configuración

- ✅ `frontend/vercel.json` - Configuración para Vercel
- ✅ `backend/render.yaml` - Configuración para Render
- ✅ `.gitignore` - Archivos sensibles excluidos

### 🚀 Pasos para Deploy

#### 1. Backend (Render)

1. Sube el código a tu repositorio Git
2. En Render Dashboard, crea un nuevo Web Service
3. Conecta tu repositorio
4. Configura las variables de entorno:
   ```
   NODE_ENV=production
   PORT=3001
   SUPABASE_URL=tu_supabase_url
   SUPABASE_SERVICE_KEY=tu_supabase_service_key
   CORS_ORIGIN=https://tu-frontend.vercel.app
   ```
5. Build Command: `cd backend && npm install`
6. Start Command: `cd backend && npm start`
7. Root Directory: `backend`

#### 2. Frontend (Vercel)

1. En Vercel Dashboard, importa tu repositorio
2. Configura el proyecto:
   - Framework Preset: Vite
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`
3. Configura las variables de entorno:
   ```
   VITE_SUPABASE_URL=tu_supabase_url
   VITE_SUPABASE_ANON_KEY=tu_supabase_anon_key
   VITE_API_URL=https://tu-backend.onrender.com
   ```
4. Deploy

#### 3. Actualizar CORS

Una vez que tengas la URL de Vercel, actualiza `CORS_ORIGIN` en Render con la URL completa del frontend.

### 🔒 Seguridad

- ✅ Variables de entorno no están en el repositorio
- ✅ Logs sensibles deshabilitados en producción
- ✅ Autenticación con Supabase Auth
- ✅ Rate limiting configurado
- ✅ CORS configurado correctamente

### 📝 Notas Importantes

- El backend usa `NODE_ENV=production` para deshabilitar logs de desarrollo
- El frontend usa `import.meta.env.DEV` para detectar el modo desarrollo
- Todos los errores críticos se siguen registrando en producción
- Los warnings importantes se mantienen para monitoreo

### 🐛 Troubleshooting

Si encuentras problemas en producción:

1. Revisa los logs en Render Dashboard (solo errores y warnings)
2. Revisa la consola del navegador (solo errores)
3. Verifica que todas las variables de entorno estén configuradas
4. Asegúrate de que el backend esté respondiendo en `/health`
