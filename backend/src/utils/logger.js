// Utilidad de logging para el backend
const isDevelopment = process.env.NODE_ENV !== 'production'

const getTimestamp = () => {
  return new Date().toISOString()
}

const formatMessage = (level, message, data) => {
  const timestamp = getTimestamp()
  const emoji = {
    info: 'ℹ️',
    success: '✅',
    warn: '⚠️',
    error: '❌',
  }[level] || '📝'

  return `[${timestamp}] ${emoji} [${level.toUpperCase()}] ${message}`
}

export const logger = {
  info: (message, data) => {
    // Mostrar info siempre (necesario para diagnosticar OCR en producción)
    const formatted = formatMessage('info', message, data)
    if (data) {
      console.log(formatted, data)
    } else {
      console.log(formatted)
    }
  },
  
  debug: (message, data) => {
    // Debug solo en desarrollo
    if (isDevelopment) {
      const formatted = formatMessage('debug', message, data)
      if (data) {
        console.log(formatted, data)
      } else {
        console.log(formatted)
      }
    }
  },

  success: (message, data) => {
    if (isDevelopment) {
      const formatted = formatMessage('success', message, data)
      if (data) {
        console.log(formatted, data)
      } else {
        console.log(formatted)
      }
    }
  },

  warn: (message, data) => {
    // Siempre loggear warnings (importantes para producción)
    const formatted = formatMessage('warn', message, data)
    if (data) {
      console.warn(formatted, data)
    } else {
      console.warn(formatted)
    }
  },

  error: (message, error) => {
    // Siempre loggear errores (críticos para producción)
    const formatted = formatMessage('error', message, error)
    if (error) {
      console.error(formatted, error)
      if (error.stack) {
        console.error('Stack trace:', error.stack)
      }
    } else {
      console.error(formatted)
    }
  },

  request: (req) => {
    if (isDevelopment) {
      const { method, url, ip, headers } = req
      logger.info(`Request: ${method} ${url}`, {
        ip,
        userAgent: headers['user-agent'],
        contentType: headers['content-type'],
      })
    }
  },

  response: (req, res, responseTime) => {
    if (isDevelopment) {
      const { method, url } = req
      const { statusCode } = res
      const emoji = statusCode >= 500 ? '❌' : statusCode >= 400 ? '⚠️' : '✅'
      logger.info(
        `Response: ${method} ${url} - ${statusCode} ${emoji} (${responseTime}ms)`
      )
    }
  },
}
