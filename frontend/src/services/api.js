import axios from 'axios'
import { supabase } from '../lib/supabase'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Logger helper - Solo logs en desarrollo
const isDevelopment = import.meta.env.DEV

const logger = {
  info: (message, data) => {
    if (isDevelopment) {
      console.log(`[API] ℹ️ ${message}`, data || '')
    }
  },
  error: (message, error) => {
    // Siempre loggear errores
    console.error(`[API] ❌ ${message}`, error)
  },
  warn: (message, data) => {
    // Siempre loggear warnings
    console.warn(`[API] ⚠️ ${message}`, data || '')
  },
  success: (message, data) => {
    if (isDevelopment) {
      console.log(`[API] ✅ ${message}`, data || '')
    }
  },
}

// Interceptor para requests - logging y autenticación
api.interceptors.request.use(
  async (config) => {
    if (isDevelopment) {
      const timestamp = new Date().toISOString()
      logger.info(`[${timestamp}] Request: ${config.method?.toUpperCase()} ${config.url}`, {
        params: config.params,
        data: config.data,
      })
    }

    // Agregar token de autenticación
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`
        if (isDevelopment) {
          logger.info('Token de autenticación agregado')
        }
      } else if (isDevelopment) {
        logger.warn('No hay sesión activa, request sin token')
      }
    } catch (authError) {
      logger.error('Error al obtener sesión:', authError)
    }

    return config
  },
  (error) => {
    logger.error('Error en interceptor de request:', error)
    return Promise.reject(error)
  }
)

// Interceptor para responses - logging
api.interceptors.response.use(
  (response) => {
    if (isDevelopment) {
      const timestamp = new Date().toISOString()
      logger.success(
        `[${timestamp}] Response: ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`,
        {
          status: response.status,
          dataLength: Array.isArray(response.data) ? response.data.length : 'N/A',
        }
      )
    }
    return response
  },
  (error) => {
    const timestamp = new Date().toISOString()
    const errorInfo = {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      method: error.config?.method,
      data: error.response?.data,
    }

    logger.error(
      `[${timestamp}] Error Response: ${error.config?.method?.toUpperCase()} ${error.config?.url} - ${error.response?.status || 'NO STATUS'}`,
      errorInfo
    )

    // Log detallado según el tipo de error
    if (error.response) {
      // El servidor respondió con un código de estado fuera del rango 2xx
      if (error.response.status === 401) {
        logger.warn('Error 401: No autorizado. Verificar token de autenticación.')
      } else if (error.response.status === 404) {
        logger.warn('Error 404: Recurso no encontrado. Verificar ruta del endpoint.')
      } else if (error.response.status >= 500) {
        logger.error('Error del servidor. Contactar al administrador.')
      }
    } else if (error.request) {
      // La petición fue hecha pero no se recibió respuesta
      logger.error('No se recibió respuesta del servidor. Verificar que el backend esté corriendo.')
    } else {
      // Algo pasó al configurar la petición
      logger.error('Error al configurar la petición:', error.message)
    }

    return Promise.reject(error)
  }
)

export default api
export { logger }
