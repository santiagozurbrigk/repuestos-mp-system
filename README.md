# Sistema Interno MP - Casa de Repuestos

Sistema web de gestión interna para local físico de repuestos y accesorios para automóviles.

## 🎯 Características

- ✅ Registro de ventas simplificado (sin control de stock)
- ✅ Caja y cierre diario
- ✅ Listas de artículos a pedir
- ✅ Estadísticas y reportes
- ✅ Autenticación con Supabase

## 🧱 Stack Tecnológico

### Frontend
- React + Vite
- Tailwind CSS
- Deploy en Vercel

### Backend
- Node.js + Express
- Deploy en Render

### Base de Datos
- Supabase (PostgreSQL)
- Supabase Auth

## 📁 Estructura del Proyecto

```
/
├── frontend/          # Aplicación React
├── backend/           # API REST Node.js
└── README.md
```

## 🚀 Configuración Local

### Prerrequisitos
- Node.js 18+
- npm o yarn
- Cuenta de Supabase

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
npm install
npm run dev
```

## 🔧 Variables de Entorno

### Frontend (.env)
```
VITE_SUPABASE_URL=tu_supabase_url
VITE_SUPABASE_ANON_KEY=tu_supabase_anon_key
VITE_API_URL=http://localhost:3001
```

### Backend (.env)
```
PORT=3001
SUPABASE_URL=tu_supabase_url
SUPABASE_SERVICE_KEY=tu_supabase_service_key
CORS_ORIGIN=http://localhost:5173
```

## 📚 Documentación Adicional

- [SETUP.md](./SETUP.md) - Guía completa de configuración local
- [DEPLOY.md](./DEPLOY.md) - Guía de deploy en Vercel y Render
- [database/schema.sql](./database/schema.sql) - Esquema de base de datos

## 📝 Notas Importantes

- ❌ El sistema NO maneja stock
- ❌ Las ventas no requieren asociar productos individuales
- ✅ Optimizado para uso rápido en mostrador
- ✅ Sistema de cierre de caja diario
- ✅ Listas de pedidos acumulativas
- ✅ Estadísticas y reportes visuales

## 🔐 Seguridad

- Las variables de entorno nunca deben subirse a Git
- Usa `.env.example` como referencia para las variables necesarias
- El backend valida tokens de autenticación en cada request
- Row Level Security (RLS) habilitado en Supabase

## 🛠️ Desarrollo

Para más detalles sobre cómo configurar y desarrollar el proyecto, consulta [SETUP.md](./SETUP.md)

Para información sobre el despliegue en producción, consulta [DEPLOY.md](./DEPLOY.md)
