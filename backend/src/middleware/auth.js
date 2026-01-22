import { createClient } from '@supabase/supabase-js'
import env from '../config/env.js'
import { logger } from '../utils/logger.js'

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

export const authenticateToken = async (req, res, next) => {
  try {
    // Permitir peticiones OPTIONS (preflight) sin autenticación
    if (req.method === 'OPTIONS') {
      return next()
    }

    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1]

    if (!token) {
      logger.warn(`Intento de acceso sin token: ${req.method} ${req.url}`)
      return res.status(401).json({ error: 'Token de autenticación requerido' })
    }

    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      logger.warn(`Token inválido o expirado: ${error?.message || 'Usuario no encontrado'}`)
      return res.status(401).json({ error: 'Token inválido o expirado' })
    }

    req.user = user
    next()
  } catch (error) {
    logger.error('Error en middleware de autenticación:', error)
    // Asegurar que el error no rompa CORS
    res.status(500).json({ error: 'Error al verificar autenticación' })
  }
}
