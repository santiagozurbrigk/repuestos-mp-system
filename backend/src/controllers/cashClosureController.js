import { supabase } from '../config/supabase.js'
import '../config/env.js'
import { logger } from '../utils/logger.js'
import { getLocalDateString, parseLocalDate, getDayRange } from '../utils/dateHelpers.js'

export const getTodaySalesSummary = async (req, res) => {
  try {
    // Usar fecha local para evitar problemas de zona horaria
    const todayStr = getLocalDateString()
    const { start, end } = getDayRange(todayStr)

    // Verificar si ya existe un cierre para hoy
    const { data: existingClosure, error: closureError } = await supabase
      .from('cash_closures')
      .select('*')
      .eq('closure_date', todayStr)
      .maybeSingle()

    if (closureError && closureError.code !== 'PGRST116') {
      logger.error('Error al verificar cierre existente:', closureError)
      return res.status(500).json({ error: 'Error al verificar cierre de caja' })
    }

    if (existingClosure) {
      return res.json({
        ...existingClosure,
        isClosed: true,
      })
    }

    // Obtener todas las fechas de cierres existentes para excluir ventas ya cerradas
    const { data: allClosures, error: closuresError } = await supabase
      .from('cash_closures')
      .select('closure_date')

    if (closuresError) {
      logger.warn('Error al obtener fechas de cierres (continuando sin filtrar):', closuresError)
    }

    const closedDates = allClosures ? allClosures.map(c => c.closure_date) : []

    // Obtener ventas del día usando rango de fechas local
    const { data: sales, error: salesError } = await supabase
      .from('sales')
      .select('*')
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false })

    if (salesError) {
      logger.error('Error al obtener ventas del día:', salesError)
      return res.status(500).json({ error: 'Error al obtener las ventas del día' })
    }

    // Filtrar ventas: solo incluir ventas de HOY que NO estén en días ya cerrados
    // Convertir fecha de venta a string local para comparación consistente
    const salesToInclude = (sales || []).filter((sale) => {
      const saleDateObj = new Date(sale.date)
      const saleDateLocal = getLocalDateString(saleDateObj)
      // Solo incluir ventas de hoy que no estén en días cerrados
      return saleDateLocal === todayStr && !closedDates.includes(saleDateLocal)
    })

    // Calcular totales solo de ventas que no están en cierres anteriores
    const summary = {
      closure_date: todayStr,
      total_sales: 0,
      total_cash: 0,
      total_card: 0,
      total_transfer: 0,
      total_other: 0,
      sales_count: salesToInclude.length,
      isClosed: false,
    }

    salesToInclude.forEach((sale) => {
      summary.total_sales += parseFloat(sale.total_amount)
      switch (sale.payment_method) {
        case 'cash':
          summary.total_cash += parseFloat(sale.total_amount)
          break
        case 'card':
          summary.total_card += parseFloat(sale.total_amount)
          break
        case 'transfer':
          summary.total_transfer += parseFloat(sale.total_amount)
          break
        case 'other':
          summary.total_other += parseFloat(sale.total_amount)
          break
      }
    })

    res.json(summary)
  } catch (error) {
    logger.error('Error inesperado en getTodaySalesSummary:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const createCashClosure = async (req, res) => {
  try {
    const userId = req.user.id
    const { closure_date } = req.body

    // Usar fecha local para evitar problemas de zona horaria
    const dateStr = closure_date ? closure_date : getLocalDateString()
    
    // Validar formato de fecha
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      logger.warn('Formato de fecha inválido recibido', { closure_date })
      return res.status(400).json({ error: 'Formato de fecha inválido. Use YYYY-MM-DD' })
    }

    logger.info('Creando cierre de caja', { date: dateStr, userId })

    // Verificar si ya existe un cierre para esta fecha
    const { data: existingClosure, error: checkError } = await supabase
      .from('cash_closures')
      .select('*')
      .eq('closure_date', dateStr)
      .maybeSingle()

    if (checkError && checkError.code !== 'PGRST116') {
      logger.error('Error al verificar cierre existente:', checkError)
      return res.status(500).json({ error: 'Error al verificar cierre de caja existente' })
    }

    if (existingClosure) {
      logger.warn(`Intento de crear cierre duplicado para fecha: ${dateStr}`, {
        existingClosureId: existingClosure.id,
        existingClosureDate: existingClosure.closure_date,
        userId,
      })
      return res.status(400).json({ 
        error: `Ya existe un cierre de caja para la fecha ${dateStr}. El cierre fue realizado el ${new Date(existingClosure.closed_at).toLocaleDateString('es-ES')}. Si necesitas modificar el cierre, contacta al administrador.` 
      })
    }

    // Obtener ventas del día usando rango de fechas local
    const { start, end } = getDayRange(dateStr)

    const { data: sales, error: salesError } = await supabase
      .from('sales')
      .select('*')
      .gte('date', start)
      .lte('date', end)

    if (salesError) {
      logger.error('Error al obtener ventas para cierre de caja:', salesError)
      return res.status(500).json({ error: 'Error al obtener las ventas' })
    }

    // Calcular totales
    const closureData = {
      user_id: userId,
      closure_date: dateStr,
      total_sales: 0,
      total_cash: 0,
      total_card: 0,
      total_transfer: 0,
      total_other: 0,
      sales_count: sales.length,
    }

    sales.forEach((sale) => {
      closureData.total_sales += parseFloat(sale.total_amount)
      switch (sale.payment_method) {
        case 'cash':
          closureData.total_cash += parseFloat(sale.total_amount)
          break
        case 'card':
          closureData.total_card += parseFloat(sale.total_amount)
          break
        case 'transfer':
          closureData.total_transfer += parseFloat(sale.total_amount)
          break
        case 'other':
          closureData.total_other += parseFloat(sale.total_amount)
          break
      }
    })

    const { data, error } = await supabase
      .from('cash_closures')
      .insert([closureData])
      .select()
      .single()

    if (error) {
      logger.error('Error al crear cierre de caja en Supabase:', error)
      return res.status(500).json({ error: 'Error al crear el cierre de caja' })
    }

    res.status(201).json(data)
  } catch (error) {
    logger.error('Error inesperado en createCashClosure:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const getCashClosures = async (req, res) => {
  try {
    const { startDate, endDate, limit = 50, offset = 0 } = req.query

    let query = supabase
      .from('cash_closures')
      .select('*')
      .order('closure_date', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)

    if (startDate) {
      query = query.gte('closure_date', startDate)
    }

    if (endDate) {
      query = query.lte('closure_date', endDate)
    }

    const { data, error } = await query

    if (error) {
      logger.error('Error al obtener cierres de caja de Supabase:', error)
      return res.status(500).json({ error: 'Error al obtener los cierres de caja' })
    }

    res.json(data)
  } catch (error) {
    logger.error('Error inesperado en getCashClosures:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const getCashClosureByDate = async (req, res) => {
  try {
    const { date } = req.params

    const { data, error } = await supabase
      .from('cash_closures')
      .select('*')
      .eq('closure_date', date)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        logger.warn(`Cierre de caja no encontrado para fecha: ${date}`)
        return res.status(404).json({ error: 'Cierre de caja no encontrado' })
      }
      logger.error('Error al obtener cierre de caja de Supabase:', error)
      return res.status(500).json({ error: 'Error al obtener el cierre de caja' })
    }

    res.json(data)
  } catch (error) {
    logger.error('Error inesperado en getCashClosureByDate:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const deleteCashClosure = async (req, res) => {
  try {
    const { id } = req.params

    const { error } = await supabase
      .from('cash_closures')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('Error al eliminar cierre de caja de Supabase:', error)
      return res.status(500).json({ error: 'Error al eliminar el cierre de caja' })
    }

    res.json({ message: 'Cierre de caja eliminado correctamente' })
  } catch (error) {
    logger.error('Error inesperado en deleteCashClosure:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}
