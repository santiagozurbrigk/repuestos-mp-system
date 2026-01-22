// Utilidades para manejo de fechas consistentes
// Zona horaria: Buenos Aires, Argentina (UTC-3)

const BUENOS_AIRES_OFFSET = -3 // UTC-3

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD usando la zona horaria de Buenos Aires
 */
export const getBuenosAiresDateString = (date = new Date()) => {
  // Obtener la fecha en UTC
  const utcDate = new Date(date.toISOString())
  
  // Aplicar offset de Buenos Aires (UTC-3)
  const buenosAiresTime = new Date(utcDate.getTime() + (BUENOS_AIRES_OFFSET * 60 * 60 * 1000))
  
  // Obtener componentes de fecha
  const year = buenosAiresTime.getUTCFullYear()
  const month = String(buenosAiresTime.getUTCMonth() + 1).padStart(2, '0')
  const day = String(buenosAiresTime.getUTCDate()).padStart(2, '0')
  
  return `${year}-${month}-${day}`
}

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD usando la zona horaria de Buenos Aires
 * (Alias para mantener compatibilidad)
 */
export const getLocalDateString = getBuenosAiresDateString

/**
 * Convierte una fecha string (YYYY-MM-DD) a Date object en inicio del día en Buenos Aires
 */
export const parseLocalDate = (dateString) => {
  const [year, month, day] = dateString.split('-').map(Number)
  // Crear fecha en UTC pero representando el inicio del día en Buenos Aires
  const date = new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0)) // +3 horas para compensar UTC-3
  return date
}

/**
 * Obtiene el inicio y fin del día en formato ISO para consultas
 * Considerando la zona horaria de Buenos Aires (UTC-3)
 */
export const getDayRange = (dateString) => {
  const [year, month, day] = dateString.split('-').map(Number)
  
  // Inicio del día en Buenos Aires (00:00:00 BA = 03:00:00 UTC)
  const start = new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0))
  
  // Fin del día en Buenos Aires (23:59:59 BA = 02:59:59 UTC del día siguiente)
  const end = new Date(Date.UTC(year, month - 1, day + 1, 2, 59, 59, 999))
  
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  }
}

/**
 * Obtiene la fecha y hora actual en Buenos Aires como string ISO
 */
export const getBuenosAiresDateTime = (date = new Date()) => {
  const utcDate = new Date(date.toISOString())
  const buenosAiresTime = new Date(utcDate.getTime() + (BUENOS_AIRES_OFFSET * 60 * 60 * 1000))
  return buenosAiresTime.toISOString()
}
