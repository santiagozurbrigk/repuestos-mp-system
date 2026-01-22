# Guía de Configuración Local - Sistema Interno MP

Esta guía te ayudará a configurar el proyecto localmente para desarrollo.

## 📋 Prerrequisitos

- Node.js 18 o superior
- npm o yarn
- Cuenta en Supabase

## 🚀 Configuración Inicial

### 1. Clonar el repositorio

```bash
git clone <tu-repositorio>
cd "Sistema interno MP"
```

### 2. Configurar Supabase

1. Crea un proyecto en [Supabase](https://supabase.com)
2. Ve a SQL Editor y ejecuta el contenido de `database/schema.sql`
3. Anota las siguientes credenciales:
   - Project URL
   - Anon Key
   - Service Role Key (Settings > API)

### 3. Configurar Backend

```bash
cd backend
npm install
```

Crea un archivo `.env` en la carpeta `backend/`:

```env
PORT=3001
SUPABASE_URL=tu_supabase_url
SUPABASE_SERVICE_KEY=tu_supabase_service_key
CORS_ORIGIN=http://localhost:5173
```

### 4. Configurar Frontend

```bash
cd ../frontend
npm install
```

Crea un archivo `.env` en la carpeta `frontend/`:

```env
VITE_SUPABASE_URL=tu_supabase_url
VITE_SUPABASE_ANON_KEY=tu_supabase_anon_key
VITE_API_URL=http://localhost:3001
```

## 🏃 Ejecutar el Proyecto

### Backend

En una terminal:

```bash
cd backend
npm run dev
```

El backend estará disponible en `http://localhost:3001`

### Frontend

En otra terminal:

```bash
cd frontend
npm run dev
```

El frontend estará disponible en `http://localhost:5173`

## 👤 Crear Usuario de Prueba

1. Ve a Supabase Dashboard > Authentication > Users
2. Click en "Add User" > "Create new user"
3. Ingresa email y contraseña
4. Opcionalmente, puedes cambiar el rol a "admin" en la tabla `user_profiles`:
   ```sql
   UPDATE user_profiles SET role = 'admin' WHERE email = 'tu-email@ejemplo.com';
   ```

## ✅ Verificar que Todo Funciona

1. Abre `http://localhost:5173` en tu navegador
2. Deberías ver la página de login
3. Inicia sesión con el usuario creado
4. Deberías ver el dashboard

## 🐛 Troubleshooting

### Error de conexión a Supabase

- Verifica que las variables de entorno sean correctas
- Asegúrate de que el proyecto de Supabase esté activo

### Error de CORS

- Verifica que `CORS_ORIGIN` en el backend apunte a `http://localhost:5173`
- Asegúrate de que el backend esté corriendo

### Error de autenticación

- Verifica que el esquema de base de datos se haya ejecutado correctamente
- Revisa que el usuario exista en Supabase Auth

## 📝 Estructura del Proyecto

```
/
├── frontend/          # Aplicación React
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── contexts/
│   │   ├── services/
│   │   └── lib/
│   └── package.json
├── backend/           # API REST
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   └── config/
│   └── package.json
├── database/          # Esquema SQL
│   └── schema.sql
└── README.md
```

## 🔧 Scripts Disponibles

### Frontend

- `npm run dev` - Inicia servidor de desarrollo
- `npm run build` - Construye para producción
- `npm run preview` - Previsualiza build de producción

### Backend

- `npm run dev` - Inicia servidor con watch mode
- `npm start` - Inicia servidor de producción
