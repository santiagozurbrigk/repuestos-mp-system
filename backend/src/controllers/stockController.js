import { supabase } from '../config/supabase.js'
import { logger } from '../utils/logger.js'

// ========== CRUD de Stock Pendiente ==========

export const getPendingStock = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('stock_pending')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('Error al obtener stock pendiente:', error)
      return res.status(500).json({ error: 'Error al obtener el stock pendiente' })
    }

    res.json(data || [])
  } catch (error) {
    logger.error('Error inesperado en getPendingStock:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const generateBarcode = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    // Generar código de barras único (usando timestamp + random)
    const timestamp = Date.now()
    const random = Math.floor(Math.random() * 10000)
    const barcode = `${timestamp}${random}`.padStart(13, '0').substring(0, 13)

    const { data, error } = await supabase
      .from('stock_pending')
      .update({ barcode })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      logger.error('Error al generar código de barras:', error)
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Item de stock pendiente no encontrado' })
      }
      return res.status(500).json({ error: 'Error al generar el código de barras' })
    }

    res.json(data)
  } catch (error) {
    logger.error('Error inesperado en generateBarcode:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const confirmPendingItem = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    // Obtener el item pendiente
    const { data: pendingItem, error: fetchError } = await supabase
      .from('stock_pending')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (fetchError || !pendingItem) {
      logger.error('Error al obtener item pendiente:', fetchError)
      return res.status(404).json({ error: 'Item de stock pendiente no encontrado' })
    }

    if (!pendingItem.barcode) {
      return res.status(400).json({ error: 'El item debe tener un código de barras antes de confirmar' })
    }

    // Verificar si ya existe un item en stock con el mismo código de barras
    const { data: existingStock } = await supabase
      .from('stock')
      .select('*')
      .eq('barcode', pendingItem.barcode)
      .single()

    if (existingStock) {
      // Si existe, actualizar la cantidad
      const { data: updatedStock, error: updateError } = await supabase
        .from('stock')
        .update({ 
          quantity: existingStock.quantity + pendingItem.quantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingStock.id)
        .select()
        .single()

      if (updateError) {
        logger.error('Error al actualizar stock existente:', updateError)
        return res.status(500).json({ error: 'Error al actualizar el stock' })
      }

      // Eliminar el item pendiente
      await supabase
        .from('stock_pending')
        .delete()
        .eq('id', id)

      return res.json(updatedStock)
    } else {
      // Crear nuevo item en stock
      const { data: newStock, error: createError } = await supabase
        .from('stock')
        .insert([{
          user_id: userId,
          item_name: pendingItem.item_name,
          code: pendingItem.code,
          brand: pendingItem.brand,
          barcode: pendingItem.barcode,
          quantity: pendingItem.quantity,
        }])
        .select()
        .single()

      if (createError) {
        logger.error('Error al crear item en stock:', createError)
        return res.status(500).json({ error: 'Error al crear el item en stock' })
      }

      // Eliminar el item pendiente
      await supabase
        .from('stock_pending')
        .delete()
        .eq('id', id)

      res.json(newStock)
    }
  } catch (error) {
    logger.error('Error inesperado en confirmPendingItem:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const deletePendingItem = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    const { error } = await supabase
      .from('stock_pending')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      logger.error('Error al eliminar item pendiente:', error)
      return res.status(500).json({ error: 'Error al eliminar el item pendiente' })
    }

    res.json({ message: 'Item pendiente eliminado correctamente' })
  } catch (error) {
    logger.error('Error inesperado en deletePendingItem:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

// ========== CRUD de Stock ==========

export const getStock = async (req, res) => {
  try {
    const { search } = req.query

    let query = supabase
      .from('stock')
      .select('*')
      .order('item_name', { ascending: true })

    if (search) {
      query = query.or(`item_name.ilike.%${search}%,code.ilike.%${search}%,brand.ilike.%${search}%,barcode.ilike.%${search}%`)
    }

    const { data, error } = await query

    if (error) {
      logger.error('Error al obtener stock:', error)
      return res.status(500).json({ error: 'Error al obtener el stock' })
    }

    res.json(data || [])
  } catch (error) {
    logger.error('Error inesperado en getStock:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const updateStockQuantity = async (req, res) => {
  try {
    const { id } = req.params
    const { quantity } = req.body
    const userId = req.user.id

    if (quantity === undefined || quantity < 0) {
      return res.status(400).json({ error: 'La cantidad debe ser un número mayor o igual a 0' })
    }

    const { data, error } = await supabase
      .from('stock')
      .update({ quantity: parseInt(quantity) })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      logger.error('Error al actualizar cantidad de stock:', error)
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Item de stock no encontrado' })
      }
      return res.status(500).json({ error: 'Error al actualizar la cantidad' })
    }

    res.json(data)
  } catch (error) {
    logger.error('Error inesperado en updateStockQuantity:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const deleteStockItem = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    const { error } = await supabase
      .from('stock')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      logger.error('Error al eliminar item de stock:', error)
      return res.status(500).json({ error: 'Error al eliminar el item de stock' })
    }

    res.json({ message: 'Item de stock eliminado correctamente' })
  } catch (error) {
    logger.error('Error inesperado en deleteStockItem:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}
