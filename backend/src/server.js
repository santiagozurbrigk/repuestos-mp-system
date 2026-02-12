// Importar configuración de entorno primero
import './config/env.js'

import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import salesRoutes from './routes/sales.js'
import cashClosureRoutes from './routes/cashClosure.js'
import orderListRoutes from './routes/orderLists.js'
import statisticsRoutes from './routes/statistics.js'
import suppliersRoutes from './routes/suppliers.js'
import invoiceItemsRoutes from './routes/invoiceItems.js'
import stockRoutes from './routes/stock.js'
import { authenticateToken } from './middleware/auth.js'
import env from './config/env.js'
import { logger } from './utils/logger.js'

const app = express()
const PORT = env.PORT

// Configuración de CORS mejorada - DEBE IR PRIMERO
// Lista de orígenes permitidos (se usa también en el error handler)
const allowedOrigins = [
  env.CORS_ORIGIN,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
].filter(Boolean) // Eliminar valores undefined/null

const isOriginAllowed = (origin) => {
  if (!origin) return true // Permitir requests sin origin
  
  // Permitir cualquier origen de Vercel (vercel.app)
  const isVercelOrigin = origin.includes('.vercel.app')
  
  // Permitir cualquier origen de localhost para desarrollo
  const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1')
  
  return allowedOrigins.includes(origin) || isVercelOrigin || isLocalhost
}

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true)
    } else {
      logger.warn(`CORS bloqueado para origin: ${origin}`)
      callback(new Error('No permitido por CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400, // 24 horas
}

// Aplicar CORS a todas las rutas PRIMERO
app.use(cors(corsOptions))

// Manejar peticiones OPTIONS (preflight) ANTES de cualquier otro middleware
app.options('*', (req, res) => {
  const origin = req.headers.origin
  if (origin && isOriginAllowed(origin)) {
    res.header('Access-Control-Allow-Origin', origin)
    res.header('Access-Control-Allow-Credentials', 'true')
  } else if (!origin) {
    res.header('Access-Control-Allow-Origin', '*')
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.header('Access-Control-Max-Age', '86400')
  res.sendStatus(200)
})

// Middleware de logging de requests (después de CORS)
app.use((req, res, next) => {
  const startTime = Date.now()
  
  // Log del request
  logger.request(req)
  
  // Log del response cuando termine
  res.on('finish', () => {
    const responseTime = Date.now() - startTime
    logger.response(req, res, responseTime)
  })
  
  next()
})

// Rate limiting (excluir peticiones OPTIONS)
// Configuración más permisiva para uso normal de la aplicación
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 500, // límite de 500 requests por ventana (aumentado de 100)
  skip: (req) => req.method === 'OPTIONS', // No aplicar rate limit a OPTIONS
  standardHeaders: true, // Retornar rate limit info en `RateLimit-*` headers
  legacyHeaders: false, // Deshabilitar `X-RateLimit-*` headers
  handler: (req, res) => {
    // Asegurar headers CORS en rate limit también
    const origin = req.headers.origin
    if (origin && isOriginAllowed(origin)) {
      res.header('Access-Control-Allow-Origin', origin)
      res.header('Access-Control-Allow-Credentials', 'true')
    }
    
    logger.warn(`Rate limit excedido para IP: ${req.ip}`)
    res.status(429).json({
      error: 'Demasiadas peticiones, por favor intenta más tarde',
    })
  },
})

app.use(limiter)

app.use(express.json())

// Ruta raíz
app.get('/', (req, res) => {
  res.json({ 
    message: 'Sistema Interno MP API',
    status: 'ok',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: '/api'
    }
  })
})

// Health check
app.get('/health', (req, res) => {
  // Health check no necesita logging
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  })
})

// Middleware para manejar errores de autenticación sin romper CORS
const handleAuthError = (err, req, res, next) => {
  if (err.name === 'UnauthorizedError' || err.status === 401) {
    // Asegurar headers CORS en errores de autenticación
    const origin = req.headers.origin
    if (origin && isOriginAllowed(origin)) {
      res.header('Access-Control-Allow-Origin', origin)
      res.header('Access-Control-Allow-Credentials', 'true')
    }
    
    logger.warn(`Acceso no autorizado: ${req.method} ${req.url}`)
    return res.status(401).json({ error: 'Token de autenticación requerido o inválido' })
  }
  next(err)
}

// Rutas protegidas
app.use('/api/sales', authenticateToken, salesRoutes)
app.use('/api/cash-closure', authenticateToken, cashClosureRoutes)
app.use('/api/order-lists', authenticateToken, orderListRoutes)
app.use('/api/statistics', authenticateToken, statisticsRoutes)
app.use('/api/suppliers', authenticateToken, suppliersRoutes)
app.use('/api/invoice-items', authenticateToken, invoiceItemsRoutes)
app.use('/api/stock', authenticateToken, stockRoutes)

// Manejar errores de autenticación
app.use(handleAuthError)

// Manejo de rutas no encontradas
app.use((req, res) => {
  // Asegurar headers CORS en 404 también
  const origin = req.headers.origin
  if (origin && isOriginAllowed(origin)) {
    res.header('Access-Control-Allow-Origin', origin)
    res.header('Access-Control-Allow-Credentials', 'true')
  }
  
  logger.warn(`Ruta no encontrada: ${req.method} ${req.url}`)
  res.status(404).json({
    error: 'Ruta no encontrada',
    path: req.url,
    method: req.method,
  })
})

// Manejo de errores mejorado
app.use((err, req, res, next) => {
  // Si la respuesta ya fue enviada, delegar al handler por defecto de Express
  if (res.headersSent) {
    return next(err)
  }

  logger.error(`Error en ${req.method} ${req.url}:`, err)
  
  const statusCode = err.status || err.statusCode || 500
  const message = err.message || 'Error interno del servidor'
  
  // Asegurar que los headers de CORS estén presentes incluso en errores
  const origin = req.headers.origin
  if (origin && isOriginAllowed(origin)) {
    res.header('Access-Control-Allow-Origin', origin)
    res.header('Access-Control-Allow-Credentials', 'true')
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  }
  
  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  })
})

// Manejo de errores no capturados
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error)
  // En producción, podrías querer cerrar el proceso
  // process.exit(1)
})

app.listen(PORT, () => {
  const isDevelopment = process.env.NODE_ENV !== 'production'
  if (isDevelopment) {
    logger.success(`Servidor iniciado en http://localhost:${PORT}`)
    logger.info(`Ambiente: ${process.env.NODE_ENV || 'development'}`)
    logger.info(`CORS origin permitido: ${env.CORS_ORIGIN}`)
  } else {
    console.log(`Servidor iniciado en puerto ${PORT}`)
  }
})
