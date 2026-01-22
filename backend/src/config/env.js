import dotenv from 'dotenv'

// Cargar variables de entorno primero
dotenv.config()

// Validar que las variables requeridas estén presentes
const requiredVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY']

for (const varName of requiredVars) {
  if (!process.env[varName]) {
    console.error(`❌ Error: Variable de entorno faltante: ${varName}`)
    console.error(`\nPor favor, crea un archivo .env en la carpeta backend/ con las siguientes variables:`)
    console.error(`SUPABASE_URL=tu_supabase_url`)
    console.error(`SUPABASE_SERVICE_KEY=tu_supabase_service_key`)
    console.error(`PORT=3001`)
    console.error(`CORS_ORIGIN=http://localhost:5173\n`)
    process.exit(1)
  }
}

export default {
  PORT: process.env.PORT || 3001,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
}
