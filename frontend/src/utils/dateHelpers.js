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
 * Obtiene la fecha y hora actual en Buenos Aires como string ISO
 */
export const getBuenosAiresDateTime = (date = new Date()) => {
  const utcDate = new Date(date.toISOString())
  const buenosAiresTime = new Date(utcDate.getTime() + (BUENOS_AIRES_OFFSET * 60 * 60 * 1000))
  return buenosAiresTime.toISOString()
}

/**
 * Formatea una fecha para input datetime-local usando zona horaria de Buenos Aires
 */
export const formatDateTimeLocal = (date = new Date()) => {
  const utcDate = new Date(date.toISOString())
  const buenosAiresTime = new Date(utcDate.getTime() + (BUENOS_AIRES_OFFSET * 60 * 60 * 1000))
  
  const year = buenosAiresTime.getUTCFullYear()
  const month = String(buenosAiresTime.getUTCMonth() + 1).padStart(2, '0')
  const day = String(buenosAiresTime.getUTCDate()).padStart(2, '0')
  const hours = String(buenosAiresTime.getUTCHours()).padStart(2, '0')
  const minutes = String(buenosAiresTime.getUTCMinutes()).padStart(2, '0')
  
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

/**
 * Parsea una fecha string (YYYY-MM-DD) como fecha de Buenos Aires
 * Esto evita problemas cuando JavaScript interpreta la fecha como UTC
 * Cuando haces new Date("2026-01-22"), JS lo interpreta como medianoche UTC,
 * que en Buenos Aires (UTC-3) sería las 21:00 del día anterior.
 * Esta función crea la fecha correctamente para Buenos Aires.
 */
export const parseBuenosAiresDate = (dateString) => {
  if (!dateString) return null
  
  // Si es solo fecha (YYYY-MM-DD), crear Date en zona horaria de Buenos Aires
  const parts = dateString.split('-')
  if (parts.length !== 3) return null
  
  const [year, month, day] = parts.map(Number)
  
  // Crear fecha en UTC pero representando el mediodía del día en Buenos Aires
  // Usamos mediodía (12:00) para evitar problemas de zona horaria al mostrar
  // Mediodía en Buenos Aires (UTC-3) = 15:00 UTC del mismo día
  return new Date(Date.UTC(year, month - 1, day, 15, 0, 0, 0))
}
