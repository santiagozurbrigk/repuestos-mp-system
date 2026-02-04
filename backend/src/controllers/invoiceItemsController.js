import { supabase } from '../config/supabase.js'
import { logger } from '../utils/logger.js'

// ========== CRUD de Items de Facturas ==========

export const createInvoiceItem = async (req, res) => {
  try {
    const { invoice_id, item_name, quantity, unit_price, total_price, description } = req.body
    const userId = req.user.id

    if (!invoice_id || !item_name) {
      return res.status(400).json({ error: 'invoice_id e item_name son requeridos' })
    }

    // Calcular total_price si no se proporciona
    const calculatedTotalPrice = total_price || (parseFloat(unit_price || 0) * parseFloat(quantity || 1))

    const itemData = {
      invoice_id,
      user_id: userId,
      item_name,
      quantity: parseFloat(quantity || 1),
      unit_price: parseFloat(unit_price || 0),
      total_price: calculatedTotalPrice,
      description: description || null,
    }

    const { data, error } = await supabase
      .from('supplier_invoice_items')
      .insert([itemData])
      .select()
      .single()

    if (error) {
      logger.error('Error al crear item de factura en Supabase:', error)
      return res.status(500).json({ error: 'Error al crear el item de factura' })
    }

    res.status(201).json(data)
  } catch (error) {
    logger.error('Error inesperado en createInvoiceItem:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const getInvoiceItems = async (req, res) => {
  try {
    const { invoice_id } = req.params

    if (!invoice_id) {
      return res.status(400).json({ error: 'invoice_id es requerido' })
    }

    const { data, error } = await supabase
      .from('supplier_invoice_items')
      .select('*')
      .eq('invoice_id', invoice_id)
      .order('created_at', { ascending: true })

    if (error) {
      logger.error('Error al obtener items de factura en Supabase:', error)
      return res.status(500).json({ error: 'Error al obtener los items de factura' })
    }

    res.json(data || [])
  } catch (error) {
    logger.error('Error inesperado en getInvoiceItems:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const updateInvoiceItem = async (req, res) => {
  try {
    const { id } = req.params
    const { item_name, quantity, unit_price, total_price, description } = req.body
    const userId = req.user.id

    const updateData = {}

    if (item_name !== undefined) updateData.item_name = item_name
    if (quantity !== undefined) updateData.quantity = parseFloat(quantity)
    if (unit_price !== undefined) updateData.unit_price = parseFloat(unit_price)
    if (description !== undefined) updateData.description = description || null

    // Recalcular total_price si se actualiza quantity o unit_price
    if (quantity !== undefined || unit_price !== undefined) {
      const finalQuantity = updateData.quantity !== undefined ? updateData.quantity : parseFloat(quantity || 1)
      const finalUnitPrice = updateData.unit_price !== undefined ? updateData.unit_price : parseFloat(unit_price || 0)
      updateData.total_price = finalQuantity * finalUnitPrice
    } else if (total_price !== undefined) {
      updateData.total_price = parseFloat(total_price)
    }

    const { data, error } = await supabase
      .from('supplier_invoice_items')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId) // Solo el usuario que creó el item puede actualizarlo
      .select()
      .single()

    if (error) {
      logger.error('Error al actualizar item de factura en Supabase:', error)
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Item de factura no encontrado' })
      }
      return res.status(500).json({ error: 'Error al actualizar el item de factura' })
    }

    res.json(data)
  } catch (error) {
    logger.error('Error inesperado en updateInvoiceItem:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const deleteInvoiceItem = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    const { error } = await supabase
      .from('supplier_invoice_items')
      .delete()
      .eq('id', id)
      .eq('user_id', userId) // Solo el usuario que creó el item puede eliminarlo

    if (error) {
      logger.error('Error al eliminar item de factura en Supabase:', error)
      return res.status(500).json({ error: 'Error al eliminar el item de factura' })
    }

    res.json({ message: 'Item de factura eliminado correctamente' })
  } catch (error) {
    logger.error('Error inesperado en deleteInvoiceItem:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const createBulkInvoiceItems = async (req, res) => {
  try {
    const { invoice_id, items } = req.body
    const userId = req.user.id

    if (!invoice_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'invoice_id y items (array) son requeridos' })
    }

    // Preparar items para inserción
    const itemsToInsert = items.map((item) => {
      const quantity = parseFloat(item.quantity || 1)
      const unitPrice = parseFloat(item.unit_price || 0)
      const totalPrice = item.total_price ? parseFloat(item.total_price) : quantity * unitPrice

      return {
        invoice_id,
        user_id: userId,
        item_name: item.item_name || item.name,
        quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
        description: item.description || null,
      }
    })

    const { data, error } = await supabase
      .from('supplier_invoice_items')
      .insert(itemsToInsert)
      .select()

    if (error) {
      logger.error('Error al crear items de factura en bulk en Supabase:', error)
      return res.status(500).json({ error: 'Error al crear los items de factura' })
    }

    res.status(201).json(data)
  } catch (error) {
    logger.error('Error inesperado en createBulkInvoiceItems:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}
