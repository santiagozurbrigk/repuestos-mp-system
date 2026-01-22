import { supabase } from '../config/supabase.js'
import { logger } from '../utils/logger.js'
import '../config/env.js'
import { getDayRange } from '../utils/dateHelpers.js'

export const getDailyStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query

    let query = supabase
      .from('sales')
      .select('date, total_amount, payment_method')

    // Convertir fechas string a rangos ISO para consultas correctas
    if (startDate) {
      const { start } = getDayRange(startDate)
      query = query.gte('date', start)
    }

    if (endDate) {
      const { end } = getDayRange(endDate)
      query = query.lte('date', end)
    }

    const { data: sales, error } = await query

    if (error) {
      logger.error('Error al obtener ventas para estadísticas diarias:', error)
      return res.status(500).json({ error: 'Error al obtener estadísticas diarias' })
    }

    // Manejar caso cuando no hay ventas
    if (!sales || sales.length === 0) {
      return res.json([])
    }

    // Agrupar por día usando fecha de Buenos Aires
    const dailyStats = {}
    sales.forEach((sale) => {
      // Convertir timestamp a fecha de Buenos Aires
      const saleDate = new Date(sale.date)
      const buenosAiresDate = new Date(saleDate.getTime() - (3 * 60 * 60 * 1000)) // UTC-3
      const date = buenosAiresDate.toISOString().split('T')[0]
      
      if (!dailyStats[date]) {
        dailyStats[date] = {
          date,
          total: 0,
          cash: 0,
          card: 0,
          transfer: 0,
          other: 0,
          count: 0,
        }
      }
      dailyStats[date].total += parseFloat(sale.total_amount)
      dailyStats[date][sale.payment_method] += parseFloat(sale.total_amount)
      dailyStats[date].count += 1
    })

    const result = Object.values(dailyStats).sort((a, b) => 
      new Date(b.date) - new Date(a.date)
    )

    res.json(result)
  } catch (error) {
    logger.error('Error inesperado en getDailyStats:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const getWeeklyStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query

    let query = supabase
      .from('sales')
      .select('date, total_amount, payment_method')

    // Convertir fechas string a rangos ISO para consultas correctas
    if (startDate) {
      const { start } = getDayRange(startDate)
      query = query.gte('date', start)
    }

    if (endDate) {
      const { end } = getDayRange(endDate)
      query = query.lte('date', end)
    }

    const { data: sales, error } = await query

    if (error) {
      logger.error('Error al obtener ventas para estadísticas semanales:', error)
      return res.status(500).json({ error: 'Error al obtener estadísticas semanales' })
    }

    // Manejar caso cuando no hay ventas
    if (!sales || sales.length === 0) {
      return res.json([])
    }

    // Agrupar por semana usando fecha de Buenos Aires
    const weeklyStats = {}
    sales.forEach((sale) => {
      // Convertir timestamp a fecha de Buenos Aires
      const saleDate = new Date(sale.date)
      const buenosAiresDate = new Date(saleDate.getTime() - (3 * 60 * 60 * 1000)) // UTC-3
      const weekStart = new Date(buenosAiresDate)
      weekStart.setUTCDate(buenosAiresDate.getUTCDate() - buenosAiresDate.getUTCDay())
      weekStart.setUTCHours(0, 0, 0, 0)
      const weekKey = weekStart.toISOString().split('T')[0]

      if (!weeklyStats[weekKey]) {
        weeklyStats[weekKey] = {
          week_start: weekKey,
          total: 0,
          cash: 0,
          card: 0,
          transfer: 0,
          other: 0,
          count: 0,
        }
      }
      weeklyStats[weekKey].total += parseFloat(sale.total_amount)
      weeklyStats[weekKey][sale.payment_method] += parseFloat(sale.total_amount)
      weeklyStats[weekKey].count += 1
    })

    const result = Object.values(weeklyStats).sort((a, b) => 
      new Date(b.week_start) - new Date(a.week_start)
    )

    res.json(result)
  } catch (error) {
    logger.error('Error inesperado en getWeeklyStats:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const getMonthlyStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query

    let query = supabase
      .from('sales')
      .select('date, total_amount, payment_method')

    // Convertir fechas string a rangos ISO para consultas correctas
    if (startDate) {
      const { start } = getDayRange(startDate)
      query = query.gte('date', start)
    }

    if (endDate) {
      const { end } = getDayRange(endDate)
      query = query.lte('date', end)
    }

    const { data: sales, error } = await query

    if (error) {
      logger.error('Error al obtener ventas para estadísticas mensuales:', error)
      return res.status(500).json({ error: 'Error al obtener estadísticas mensuales' })
    }

    // Manejar caso cuando no hay ventas
    if (!sales || sales.length === 0) {
      return res.json([])
    }

    // Agrupar por mes usando fecha de Buenos Aires
    const monthlyStats = {}
    sales.forEach((sale) => {
      // Convertir timestamp a fecha de Buenos Aires
      const saleDate = new Date(sale.date)
      const buenosAiresDate = new Date(saleDate.getTime() - (3 * 60 * 60 * 1000)) // UTC-3
      const monthKey = `${buenosAiresDate.getUTCFullYear()}-${String(buenosAiresDate.getUTCMonth() + 1).padStart(2, '0')}`

      if (!monthlyStats[monthKey]) {
        monthlyStats[monthKey] = {
          month: monthKey,
          total: 0,
          cash: 0,
          card: 0,
          transfer: 0,
          other: 0,
          count: 0,
        }
      }
      monthlyStats[monthKey].total += parseFloat(sale.total_amount)
      monthlyStats[monthKey][sale.payment_method] += parseFloat(sale.total_amount)
      monthlyStats[monthKey].count += 1
    })

    const result = Object.values(monthlyStats).sort((a, b) => 
      b.month.localeCompare(a.month)
    )

    res.json(result)
  } catch (error) {
    logger.error('Error inesperado en getMonthlyStats:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const getPaymentMethodStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query

    let query = supabase
      .from('sales')
      .select('total_amount, payment_method')

    // Convertir fechas string a rangos ISO para consultas correctas
    if (startDate) {
      const { start } = getDayRange(startDate)
      query = query.gte('date', start)
    }

    if (endDate) {
      const { end } = getDayRange(endDate)
      query = query.lte('date', end)
    }

    const { data: sales, error } = await query

    if (error) {
      logger.error('Error al obtener ventas para estadísticas de métodos de pago:', error)
      return res.status(500).json({ error: 'Error al obtener estadísticas de métodos de pago' })
    }

    // Manejar caso cuando no hay ventas
    if (!sales || sales.length === 0) {
      logger.info('No hay ventas para el rango de fechas especificado')
      return res.json({
        cash: 0,
        card: 0,
        transfer: 0,
        other: 0,
      })
    }

    const stats = {
      cash: 0,
      card: 0,
      transfer: 0,
      other: 0,
    }

    sales.forEach((sale) => {
      stats[sale.payment_method] += parseFloat(sale.total_amount)
    })

    res.json(stats)
  } catch (error) {
    logger.error('Error inesperado en getPaymentMethodStats:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const getSalesCountStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query

    let query = supabase
      .from('sales')
      .select('date')

    // Convertir fechas string a rangos ISO para consultas correctas
    if (startDate) {
      const { start } = getDayRange(startDate)
      query = query.gte('date', start)
    }

    if (endDate) {
      const { end } = getDayRange(endDate)
      query = query.lte('date', end)
    }

    const { data: sales, error } = await query

    if (error) {
      logger.error('Error al obtener ventas para estadísticas de cantidad:', error)
      return res.status(500).json({ error: 'Error al obtener estadísticas de cantidad de ventas' })
    }

    // Manejar caso cuando no hay ventas
    if (!sales || sales.length === 0) {
      return res.json([])
    }

    // Agrupar por día usando fecha de Buenos Aires
    const dailyCounts = {}
    sales.forEach((sale) => {
      // Convertir timestamp a fecha de Buenos Aires
      const saleDate = new Date(sale.date)
      const buenosAiresDate = new Date(saleDate.getTime() - (3 * 60 * 60 * 1000)) // UTC-3
      const date = buenosAiresDate.toISOString().split('T')[0]
      dailyCounts[date] = (dailyCounts[date] || 0) + 1
    })

    const result = Object.entries(dailyCounts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(b.date) - new Date(a.date))

    res.json(result)
  } catch (error) {
    logger.error('Error inesperado en getSalesCountStats:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}
