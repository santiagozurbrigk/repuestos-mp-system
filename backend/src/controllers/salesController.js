import { supabase } from '../config/supabase.js'
import '../config/env.js'
import { logger } from '../utils/logger.js'
import { getBuenosAiresDateTime } from '../utils/dateHelpers.js'

export const createSale = async (req, res) => {
  try {
    const { total_amount, payment_method, observations, date } = req.body
    const userId = req.user.id

    if (!total_amount || !payment_method) {
      logger.warn('Intento de crear venta sin datos requeridos', { total_amount, payment_method })
      return res.status(400).json({ error: 'Monto total y método de pago son requeridos' })
    }

    const validPaymentMethods = ['cash', 'card', 'transfer', 'other']
    if (!validPaymentMethods.includes(payment_method)) {
      return res.status(400).json({ error: 'Método de pago inválido' })
    }

    const saleData = {
      user_id: userId,
      total_amount: parseFloat(total_amount),
      payment_method,
      observations: observations || null,
      // Usar fecha de Buenos Aires si no se proporciona
      date: date ? new Date(date) : new Date(getBuenosAiresDateTime()),
    }

    const { data, error } = await supabase
      .from('sales')
      .insert([saleData])
      .select()
      .single()

    if (error) {
      logger.error('Error al crear venta en Supabase:', error)
      return res.status(500).json({ error: 'Error al crear la venta' })
    }

    res.status(201).json(data)
  } catch (error) {
    logger.error('Error inesperado en createSale:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const getSales = async (req, res) => {
  try {
    const { startDate, endDate, limit = 100, offset = 0 } = req.query

    let query = supabase
      .from('sales')
      .select('*')
      .order('date', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)

    if (startDate) {
      query = query.gte('date', startDate)
    }

    if (endDate) {
      query = query.lte('date', endDate)
    }

    const { data, error } = await query

    if (error) {
      logger.error('Error al obtener ventas de Supabase:', error)
      return res.status(500).json({ error: 'Error al obtener las ventas' })
    }

    res.json(data)
  } catch (error) {
    logger.error('Error inesperado en getSales:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const getSaleById = async (req, res) => {
  try {
    const { id } = req.params

    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        logger.warn(`Venta no encontrada: ${id}`)
        return res.status(404).json({ error: 'Venta no encontrada' })
      }
      logger.error('Error al obtener venta de Supabase:', error)
      return res.status(500).json({ error: 'Error al obtener la venta' })
    }

    res.json(data)
  } catch (error) {
    logger.error('Error inesperado en getSaleById:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const updateSale = async (req, res) => {
  try {
    const { id } = req.params
    const { total_amount, payment_method, observations, date } = req.body

    const updateData = {}

    if (total_amount !== undefined) updateData.total_amount = parseFloat(total_amount)
    if (payment_method !== undefined) {
      const validPaymentMethods = ['cash', 'card', 'transfer', 'other']
      if (!validPaymentMethods.includes(payment_method)) {
        return res.status(400).json({ error: 'Método de pago inválido' })
      }
      updateData.payment_method = payment_method
    }
    if (observations !== undefined) updateData.observations = observations
    if (date !== undefined) updateData.date = new Date(date)

    const { data, error } = await supabase
      .from('sales')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        logger.warn(`Venta no encontrada: ${id}`)
        return res.status(404).json({ error: 'Venta no encontrada' })
      }
      logger.error('Error al actualizar venta en Supabase:', error)
      return res.status(500).json({ error: 'Error al actualizar la venta' })
    }

    res.json(data)
  } catch (error) {
    logger.error('Error inesperado en updateSale:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const deleteSale = async (req, res) => {
  try {
    const { id } = req.params

    const { error } = await supabase
      .from('sales')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('Error al eliminar venta de Supabase:', error)
      return res.status(500).json({ error: 'Error al eliminar la venta' })
    }

    res.json({ message: 'Venta eliminada correctamente' })
  } catch (error) {
    logger.error('Error inesperado en deleteSale:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}
