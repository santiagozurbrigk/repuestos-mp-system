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
    // Convertir fecha de venta (timestamp UTC) a fecha local de Buenos Aires
    const salesToInclude = (sales || []).filter((sale) => {
      // sale.date es un timestamp ISO (UTC)
      const saleDate = new Date(sale.date)
      // Convertir a fecha de Buenos Aires: restar 3 horas para obtener la fecha local
      const buenosAiresDate = new Date(saleDate.getTime() - (3 * 60 * 60 * 1000))
      const saleDateLocal = buenosAiresDate.toISOString().split('T')[0]
      // Solo incluir ventas de hoy que no estén en días cerrados
      return saleDateLocal === todayStr && !closedDates.includes(saleDateLocal)
    })

    // Obtener el cierre del día anterior para calcular el balance inicial
    const yesterday = new Date(todayStr)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]
    
    const { data: previousClosure } = await supabase
      .from('cash_closures')
      .select('final_balance, bank_withdrawal')
      .eq('closure_date', yesterdayStr)
      .maybeSingle()

    // Calcular balance inicial: final_balance del día anterior - retiro bancario
    let initialBalance = 0
    if (previousClosure) {
      const withdrawal = previousClosure.bank_withdrawal || 0
      initialBalance = parseFloat(previousClosure.final_balance || 0) - parseFloat(withdrawal)
    }

    // Calcular totales solo de ventas que no están en cierres anteriores
    let totalSales = 0
    let totalCash = 0
    let totalDebit = 0
    let totalCredit = 0
    let totalExpenses = 0
    let totalFreight = 0

    salesToInclude.forEach((sale) => {
      const amount = parseFloat(sale.total_amount)
      
      // Solo contar como ventas si NO son egresos
      if (sale.payment_method !== 'expenses' && sale.payment_method !== 'freight') {
        totalSales += amount
      }
      
      switch (sale.payment_method) {
        case 'cash':
          totalCash += amount
          break
        case 'debit':
          totalDebit += amount
          break
        case 'credit':
          totalCredit += amount
          break
        case 'expenses':
          totalExpenses += amount
          break
        case 'freight':
          totalFreight += amount
          break
      }
    })

    // Calcular comisiones de empleados (solo sobre ventas, no egresos)
    const fernandoCommission = totalSales * 0.10
    const pedroCommission = totalSales * 0.15

    // Calcular balance final: inicial + ventas - egresos - comisiones
    const finalBalance = initialBalance + totalSales - totalExpenses - totalFreight - fernandoCommission - pedroCommission

    const summary = {
      closure_date: todayStr,
      total_sales: totalSales,
      total_cash: totalCash,
      total_debit: totalDebit,
      total_credit: totalCredit,
      total_expenses: totalExpenses,
      total_freight: totalFreight,
      sales_count: salesToInclude.length,
      initial_balance: initialBalance,
      fernando_commission: fernandoCommission,
      pedro_commission: pedroCommission,
      final_balance: finalBalance,
      isClosed: false,
    }

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

    // Filtrar ventas para incluir solo las del día específico (en caso de que el rango capture ventas del día siguiente)
    const salesForDate = (sales || []).filter((sale) => {
      const saleDate = new Date(sale.date)
      const buenosAiresDate = new Date(saleDate.getTime() - (3 * 60 * 60 * 1000))
      const saleDateLocal = buenosAiresDate.toISOString().split('T')[0]
      return saleDateLocal === dateStr
    })

    // Obtener el cierre del día anterior para calcular el balance inicial
    const dateObj = new Date(dateStr)
    dateObj.setDate(dateObj.getDate() - 1)
    const previousDateStr = dateObj.toISOString().split('T')[0]
    
    const { data: previousClosure } = await supabase
      .from('cash_closures')
      .select('final_balance, bank_withdrawal')
      .eq('closure_date', previousDateStr)
      .maybeSingle()

    // Calcular balance inicial: final_balance del día anterior - retiro bancario
    let initialBalance = 0
    if (previousClosure) {
      const withdrawal = previousClosure.bank_withdrawal || 0
      initialBalance = parseFloat(previousClosure.final_balance || 0) - parseFloat(withdrawal)
    }

    // Calcular totales
    let totalSales = 0
    let totalCash = 0
    let totalDebit = 0
    let totalCredit = 0
    let totalExpenses = 0
    let totalFreight = 0

    salesForDate.forEach((sale) => {
      const amount = parseFloat(sale.total_amount)
      
      // Solo contar como ventas si NO son egresos
      if (sale.payment_method !== 'expenses' && sale.payment_method !== 'freight') {
        totalSales += amount
      }
      
      switch (sale.payment_method) {
        case 'cash':
          totalCash += amount
          break
        case 'debit':
          totalDebit += amount
          break
        case 'credit':
          totalCredit += amount
          break
        case 'expenses':
          totalExpenses += amount
          break
        case 'freight':
          totalFreight += amount
          break
      }
    })

    // Calcular comisiones de empleados (solo sobre ventas, no egresos)
    const fernandoCommission = totalSales * 0.10
    const pedroCommission = totalSales * 0.15

    // Calcular balance final: inicial + ventas - egresos - comisiones
    const finalBalance = initialBalance + totalSales - totalExpenses - totalFreight - fernandoCommission - pedroCommission

    const closureData = {
      user_id: userId,
      closure_date: dateStr,
      total_sales: totalSales,
      total_cash: totalCash,
      total_debit: totalDebit,
      total_credit: totalCredit,
      total_expenses: totalExpenses,
      total_freight: totalFreight,
      sales_count: salesForDate.length,
      initial_balance: initialBalance,
      fernando_commission: fernandoCommission,
      pedro_commission: pedroCommission,
      final_balance: finalBalance,
    }

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

export const updateCashClosure = async (req, res) => {
  try {
    const { id } = req.params
    const { bank_withdrawal } = req.body

    if (bank_withdrawal === undefined) {
      return res.status(400).json({ error: 'El monto de retiro bancario es requerido' })
    }

    const withdrawalAmount = parseFloat(bank_withdrawal)
    if (isNaN(withdrawalAmount) || withdrawalAmount < 0) {
      return res.status(400).json({ error: 'El monto de retiro bancario debe ser un número válido mayor o igual a 0' })
    }

    const { data, error } = await supabase
      .from('cash_closures')
      .update({ bank_withdrawal: withdrawalAmount })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        logger.warn(`Cierre de caja no encontrado: ${id}`)
        return res.status(404).json({ error: 'Cierre de caja no encontrado' })
      }
      logger.error('Error al actualizar cierre de caja en Supabase:', error)
      return res.status(500).json({ error: 'Error al actualizar el cierre de caja' })
    }

    res.json(data)
  } catch (error) {
    logger.error('Error inesperado en updateCashClosure:', error)
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
