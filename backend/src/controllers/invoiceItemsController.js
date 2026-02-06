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

    logger.info('createBulkInvoiceItems llamado', { 
      invoice_id, 
      itemsCount: items?.length,
      userId,
      sampleItem: items?.[0]
    })

    if (!invoice_id || !Array.isArray(items) || items.length === 0) {
      logger.warn('Validación fallida en createBulkInvoiceItems', { invoice_id, itemsLength: items?.length })
      return res.status(400).json({ error: 'invoice_id y items (array) son requeridos' })
    }

    // Preparar items para inserción
    const itemsToInsert = items.map((item, index) => {
      const quantity = parseFloat(item.quantity || 1)
      
      // Validar que quantity sea válido
      if (isNaN(quantity) || quantity <= 0) {
        logger.warn(`Item ${index} tiene cantidad inválida: ${item.quantity}, usando 1`)
        quantity = 1
      }
      
      // Intentar obtener total_price del item
      const totalPriceRaw = item.total_price !== undefined && item.total_price !== null 
        ? parseFloat(item.total_price) 
        : null
      
      // Intentar obtener unit_price del item
      const unitPriceRaw = item.unit_price !== undefined && item.unit_price !== null 
        ? parseFloat(item.unit_price) 
        : null
      
      // Calcular valores finales
      let finalTotalPrice = 0
      let finalUnitPrice = 0
      
      // Si tenemos total_price válido, usarlo
      if (totalPriceRaw !== null && !isNaN(totalPriceRaw) && totalPriceRaw > 0) {
        finalTotalPrice = totalPriceRaw
        // Calcular unit_price desde total_price si no tenemos unit_price válido
        if (unitPriceRaw === null || isNaN(unitPriceRaw) || unitPriceRaw <= 0) {
          finalUnitPrice = finalTotalPrice / quantity
        } else {
          finalUnitPrice = unitPriceRaw
        }
      } 
      // Si no tenemos total_price pero sí unit_price, calcular total_price
      else if (unitPriceRaw !== null && !isNaN(unitPriceRaw) && unitPriceRaw > 0) {
        finalUnitPrice = unitPriceRaw
        finalTotalPrice = finalUnitPrice * quantity
      }
      // Si no tenemos ninguno, usar 0 (pero esto debería ser raro)
      else {
        logger.warn(`Item ${index} no tiene precios válidos, usando 0`, {
          total_price: item.total_price,
          unit_price: item.unit_price,
          item_name: item.item_name
        })
        finalTotalPrice = 0
        finalUnitPrice = 0
      }

      // Validar que los valores calculados sean válidos
      if (isNaN(finalTotalPrice) || isNaN(finalUnitPrice)) {
        logger.error(`Item ${index} tiene valores NaN después del cálculo`, {
          item,
          finalTotalPrice,
          finalUnitPrice,
          quantity
        })
        throw new Error(`Item ${index} tiene valores de precio inválidos`)
      }

      const itemData = {
        invoice_id,
        user_id: userId,
        item_name: item.item_name || item.name || '',
        quantity,
        unit_price: finalUnitPrice,
        total_price: finalTotalPrice,
        description: item.description || null,
      }

      logger.info(`Item ${index} preparado:`, {
        item_name: itemData.item_name,
        quantity: itemData.quantity,
        unit_price: itemData.unit_price,
        total_price: itemData.total_price
      })
      return itemData
    })

    logger.info(`Insertando ${itemsToInsert.length} items en Supabase`)

    const { data, error } = await supabase
      .from('supplier_invoice_items')
      .insert(itemsToInsert)
      .select()

    if (error) {
      logger.error('Error al crear items de factura en bulk en Supabase:', {
        error,
        errorCode: error.code,
        errorMessage: error.message,
        errorDetails: error.details,
        errorHint: error.hint,
        itemsToInsert: itemsToInsert.slice(0, 2) // Primeros 2 para debugging
      })
      return res.status(500).json({ 
        error: 'Error al crear los items de factura',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }

    logger.info(`Items creados exitosamente: ${data?.length || 0}`)
    res.status(201).json(data)
  } catch (error) {
    logger.error('Error inesperado en createBulkInvoiceItems:', {
      error,
      errorMessage: error.message,
      errorStack: error.stack
    })
    res.status(500).json({ 
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}
