import { supabase } from '../config/supabase.js'
import { logger } from '../utils/logger.js'
import '../config/env.js'
import { getBuenosAiresDateString } from '../utils/dateHelpers.js'

export const createOrderList = async (req, res) => {
  try {
    const userId = req.user.id
    const { created_date } = req.body

    // Siempre usar fecha de Buenos Aires (ignorar created_date del body para evitar problemas)
    const dateStr = getBuenosAiresDateString()

    const { data, error } = await supabase
      .from('order_lists')
      .insert([
        {
          user_id: userId,
          created_date: dateStr,
          status: 'pending',
        },
      ])
      .select(`
        *,
        order_list_items (*)
      `)
      .single()

    if (error) {
      logger.error('Error al crear lista de pedidos en Supabase:', error)
      return res.status(500).json({ error: 'Error al crear la lista de pedidos' })
    }

    res.status(201).json(data)
  } catch (error) {
    logger.error('Error inesperado en createOrderList:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const getOrderLists = async (req, res) => {
  try {
    const { startDate, endDate, status, limit = 50, offset = 0 } = req.query

    let query = supabase
      .from('order_lists')
      .select(`
        *,
        order_list_items (*)
      `)
      .order('created_date', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)

    if (startDate) {
      query = query.gte('created_date', startDate)
    }

    if (endDate) {
      query = query.lte('created_date', endDate)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      logger.error('Error al obtener listas de pedidos de Supabase:', error)
      return res.status(500).json({ error: 'Error al obtener las listas de pedidos' })
    }

    res.json(data)
  } catch (error) {
    logger.error('Error inesperado en getOrderLists:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const getOrderListById = async (req, res) => {
  try {
    const { id } = req.params

    const { data, error } = await supabase
      .from('order_lists')
      .select(`
        *,
        order_list_items (*)
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        logger.warn(`Lista de pedidos no encontrada: ${id}`)
        return res.status(404).json({ error: 'Lista de pedidos no encontrada' })
      }
      logger.error('Error al obtener lista de pedidos de Supabase:', error)
      return res.status(500).json({ error: 'Error al obtener la lista de pedidos' })
    }

    res.json(data)
  } catch (error) {
    logger.error('Error inesperado en getOrderListById:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const updateOrderList = async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body

    const updateData = {}

    if (status !== undefined) {
      const validStatuses = ['pending', 'ordered']
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Estado inválido' })
      }
      updateData.status = status
    }

    const { data, error } = await supabase
      .from('order_lists')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        logger.warn(`Lista de pedidos no encontrada para actualizar: ${id}`)
        return res.status(404).json({ error: 'Lista de pedidos no encontrada' })
      }
      logger.error('Error al actualizar lista de pedidos en Supabase:', error)
      return res.status(500).json({ error: 'Error al actualizar la lista de pedidos' })
    }

    res.json(data)
  } catch (error) {
    logger.error('Error inesperado en updateOrderList:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const deleteOrderList = async (req, res) => {
  try {
    const { id } = req.params

    const { error } = await supabase
      .from('order_lists')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('Error al eliminar lista de pedidos de Supabase:', error)
      return res.status(500).json({ error: 'Error al eliminar la lista de pedidos' })
    }

    res.json({ message: 'Lista de pedidos eliminada correctamente' })
  } catch (error) {
    logger.error('Error inesperado en deleteOrderList:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const addItemToOrderList = async (req, res) => {
  try {
    const { id } = req.params
    const { item_name, brand, observations, sector } = req.body

    if (!item_name || !item_name.trim()) {
      return res.status(400).json({ error: 'El nombre del artículo es requerido' })
    }

    // Validar sector (debe ser 1, 2, 3 o 4)
    const sectorNum = sector ? parseInt(sector) : 1
    if (![1, 2, 3, 4].includes(sectorNum)) {
      return res.status(400).json({ error: 'Sector inválido. Debe ser 1, 2, 3 o 4' })
    }

    // Verificar que la lista existe
    const { data: orderList, error: listError } = await supabase
      .from('order_lists')
      .select('*')
      .eq('id', id)
      .single()

    if (listError || !orderList) {
      return res.status(404).json({ error: 'Lista de pedidos no encontrada' })
    }

    const { data, error } = await supabase
      .from('order_list_items')
      .insert([
        {
          order_list_id: id,
          item_name: item_name.trim(),
          brand: brand ? brand.trim() : null,
          observations: observations ? observations.trim() : null,
          sector: sectorNum,
        },
      ])
      .select()
      .single()

    if (error) {
      logger.error('Error al agregar artículo a lista de pedidos en Supabase:', error)
      return res.status(500).json({ error: 'Error al agregar el artículo' })
    }

    res.status(201).json(data)
  } catch (error) {
    logger.error('Error inesperado en addItemToOrderList:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const deleteItemFromOrderList = async (req, res) => {
  try {
    const { id, itemId } = req.params

    const { error } = await supabase
      .from('order_list_items')
      .delete()
      .eq('id', itemId)
      .eq('order_list_id', id)

    if (error) {
      logger.error('Error al eliminar artículo de lista de pedidos en Supabase:', error)
      return res.status(500).json({ error: 'Error al eliminar el artículo' })
    }

    res.json({ message: 'Artículo eliminado correctamente' })
  } catch (error) {
    logger.error('Error inesperado en deleteItemFromOrderList:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}
