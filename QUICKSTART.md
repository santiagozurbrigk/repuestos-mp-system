# 🚀 Inicio Rápido - Sistema Interno MP

## Configuración en 5 minutos

### 1. Configurar Supabase (2 min)

1. Crea proyecto en [supabase.com](https://supabase.com)
2. Ve a SQL Editor y ejecuta `database/schema.sql`
3. Copia: Project URL, Anon Key, Service Role Key

### 2. Configurar Backend (1 min)

```bash
cd backend
npm install
```

Crea `backend/.env`:
```env
PORT=3001
SUPABASE_URL=tu_url_aqui
SUPABASE_SERVICE_KEY=tu_service_key_aqui
CORS_ORIGIN=http://localhost:5173
```

### 3. Configurar Frontend (1 min)

```bash
cd frontend
npm install
```

Crea `frontend/.env`:
```env
VITE_SUPABASE_URL=tu_url_aqui
VITE_SUPABASE_ANON_KEY=tu_anon_key_aqui
VITE_API_URL=http://localhost:3001
```

### 4. Ejecutar (1 min)

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### 5. Crear Usuario

1. Ve a Supabase Dashboard > Authentication > Users
2. Click "Add User" > "Create new user"
3. Ingresa email y contraseña
4. (Opcional) Cambia rol a admin:
   ```sql
   UPDATE user_profiles SET role = 'admin' WHERE email = 'tu-email@ejemplo.com';
   ```

### ✅ Listo!

Abre [http://localhost:5173](http://localhost:5173) e inicia sesión.

---

📖 Para más detalles, consulta [SETUP.md](./SETUP.md)  
🚀 Para deploy, consulta [DEPLOY.md](./DEPLOY.md)
