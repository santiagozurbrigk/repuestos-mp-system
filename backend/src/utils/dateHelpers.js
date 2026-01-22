// Utilidades para manejo de fechas consistentes
// Zona horaria: Buenos Aires, Argentina (UTC-3)

const BUENOS_AIRES_OFFSET = -3 // UTC-3

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD usando la zona horaria de Buenos Aires
 */
export const getBuenosAiresDateString = (date = new Date()) => {
  // Obtener timestamp UTC
  const utcTime = date.getTime() + (date.getTimezoneOffset() * 60 * 1000)
  
  // Aplicar offset de Buenos Aires (UTC-3): restar 3 horas
  const buenosAiresTime = utcTime - (3 * 60 * 60 * 1000)
  
  // Crear Date con esa hora y obtener componentes UTC (que representan la fecha en BA)
  const baDate = new Date(buenosAiresTime)
  const year = baDate.getUTCFullYear()
  const month = String(baDate.getUTCMonth() + 1).padStart(2, '0')
  const day = String(baDate.getUTCDate()).padStart(2, '0')
  
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
 * Crea un timestamp que representa la hora actual en Buenos Aires
 */
export const getBuenosAiresDateTime = (date = new Date()) => {
  // Obtener componentes de fecha/hora actuales
  const now = new Date()
  
  // Obtener la fecha actual en Buenos Aires
  const baDateString = getBuenosAiresDateString(now)
  const [year, month, day] = baDateString.split('-').map(Number)
  
  // Obtener hora actual del servidor (asumiendo que el servidor puede estar en cualquier timezone)
  // Usar UTC para obtener hora consistente
  const utcHours = now.getUTCHours()
  const utcMinutes = now.getUTCMinutes()
  const utcSeconds = now.getUTCSeconds()
  
  // Convertir hora UTC a hora de Buenos Aires (UTC-3)
  // Si son las 02:00 UTC, en Buenos Aires son las 23:00 del día anterior
  // Necesitamos ajustar la fecha si la hora UTC es menor a 3
  let baHours = utcHours - 3
  let baDay = day
  let baMonth = month - 1
  let baYear = year
  
  if (baHours < 0) {
    baHours += 24
    baDay -= 1
    if (baDay < 1) {
      baMonth -= 1
      if (baMonth < 0) {
        baMonth = 11
        baYear -= 1
      }
      // Obtener días del mes anterior
      const daysInMonth = new Date(baYear, baMonth + 1, 0).getDate()
      baDay = daysInMonth
    }
  }
  
  // Crear fecha en UTC que represente esta hora en Buenos Aires
  // Hora de Buenos Aires + 3 = hora UTC equivalente
  const utcEquivalentHours = baHours + 3
  return new Date(Date.UTC(baYear, baMonth, baDay, utcEquivalentHours, utcMinutes, utcSeconds, 0)).toISOString()
}
