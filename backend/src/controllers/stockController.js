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

    // Función auxiliar para normalizar strings para comparación
    const normalizeString = (str) => {
      if (!str) return null
      return str.trim().toLowerCase().replace(/\s+/g, ' ')
    }

    // Función auxiliar para comparar productos
    const isSameProduct = (item1, item2) => {
      const name1 = normalizeString(item1.item_name)
      const name2 = normalizeString(item2.item_name)
      const code1 = normalizeString(item1.code)
      const code2 = normalizeString(item2.code)
      const brand1 = normalizeString(item1.brand)
      const brand2 = normalizeString(item2.brand)

      // Comparar nombre (debe ser igual)
      if (name1 !== name2) return false

      // Si ambos tienen código, deben ser iguales
      if (code1 && code2 && code1 !== code2) return false

      // Si ambos tienen marca, deben ser iguales
      if (brand1 && brand2 && brand1 !== brand2) return false

      // Si uno tiene código y el otro no, pero tienen el mismo nombre y marca, considerarlos iguales
      // Si uno tiene marca y el otro no, pero tienen el mismo nombre y código, considerarlos iguales
      return true
    }

    // Primero verificar si ya existe un item en stock con el mismo código de barras
    let existingStock = null
    if (pendingItem.barcode) {
      const { data: stockByBarcode } = await supabase
        .from('stock')
        .select('*')
        .eq('barcode', pendingItem.barcode)
        .single()
      
      if (stockByBarcode) {
        existingStock = stockByBarcode
        logger.info(`Producto encontrado por código de barras: ${pendingItem.barcode}`)
      }
    }

    // Si no se encontró por código de barras, buscar por nombre, código y marca
    if (!existingStock) {
      logger.info('Buscando producto por nombre, código y marca...')
      
      // Obtener todos los productos del usuario para comparar
      const { data: allStock, error: fetchStockError } = await supabase
        .from('stock')
        .select('*')
        .eq('user_id', userId)

      if (fetchStockError) {
        logger.error('Error al obtener stock para comparación:', fetchStockError)
      } else if (allStock && allStock.length > 0) {
        // Buscar producto igual por nombre, código y marca
        existingStock = allStock.find(stockItem => isSameProduct(pendingItem, stockItem))
        
        if (existingStock) {
          logger.info(`Producto encontrado por nombre/código/marca: ${existingStock.item_name}`)
        }
      }
    }

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

      logger.info(`Cantidad actualizada: ${existingStock.quantity} + ${pendingItem.quantity} = ${updatedStock.quantity}`)

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

      logger.info(`Nuevo producto creado en stock: ${newStock.item_name}`)

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

export const getStockByBarcode = async (req, res) => {
  try {
    const { barcode } = req.params

    if (!barcode) {
      return res.status(400).json({ error: 'Código de barras es requerido' })
    }

    const { data, error } = await supabase
      .from('stock')
      .select('*')
      .eq('barcode', barcode)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        logger.warn(`Producto no encontrado con código de barras: ${barcode}`)
        return res.status(404).json({ error: 'Producto no encontrado o sin stock disponible' })
      }
      logger.error('Error al buscar producto por código de barras:', error)
      return res.status(500).json({ error: 'Error al buscar el producto' })
    }

    res.json(data)
  } catch (error) {
    logger.error('Error inesperado en getStockByBarcode:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const createStockItem = async (req, res) => {
  try {
    const { item_name, code, brand, barcode, quantity } = req.body
    const userId = req.user.id

    if (!item_name || !barcode) {
      return res.status(400).json({ error: 'Nombre del producto y código de barras son requeridos' })
    }

    // Verificar si ya existe un producto con ese código de barras
    const { data: existingProduct } = await supabase
      .from('stock')
      .select('*')
      .eq('barcode', barcode)
      .maybeSingle()

    if (existingProduct) {
      // Si existe, actualizar la cantidad y opcionalmente brand/code si se proporcionan
      const newQuantity = (existingProduct.quantity || 0) + (parseInt(quantity) || 1)
      const updateData = { 
        quantity: newQuantity,
        updated_at: new Date().toISOString()
      }
      
      // Actualizar brand y code si se proporcionan y no están vacíos
      if (brand && brand.trim() !== '') {
        updateData.brand = brand.trim()
      }
      if (code && code.trim() !== '') {
        updateData.code = code.trim()
      }
      
      const { data: updatedStock, error: updateError } = await supabase
        .from('stock')
        .update(updateData)
        .eq('id', existingProduct.id)
        .select()
        .single()

      if (updateError) {
        logger.error('Error al actualizar stock existente:', updateError)
        return res.status(500).json({ error: 'Error al actualizar el stock' })
      }

      logger.info(`Cantidad actualizada: ${existingProduct.quantity} + ${quantity} = ${updatedStock.quantity}`)
      return res.json(updatedStock)
    }

    // Crear nuevo producto en stock
    const { data: newStock, error: createError } = await supabase
      .from('stock')
      .insert([{
        user_id: userId,
        item_name,
        code: code || null,
        brand: brand || null,
        barcode,
        quantity: parseInt(quantity) || 1,
      }])
      .select()
      .single()

    if (createError) {
      logger.error('Error al crear producto en stock:', createError)
      return res.status(500).json({ error: 'Error al crear el producto en stock' })
    }

    logger.info(`Nuevo producto creado en stock: ${newStock.item_name}`)
    res.status(201).json(newStock)
  } catch (error) {
    logger.error('Error inesperado en createStockItem:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const generateBarcodeNumber = async (req, res) => {
  try {
    // Generar código de barras único (usando timestamp + random)
    const timestamp = Date.now()
    const random = Math.floor(Math.random() * 10000)
    const barcode = `${timestamp}${random}`.padStart(13, '0').substring(0, 13)

    res.json({ barcode })
  } catch (error) {
    logger.error('Error inesperado en generateBarcodeNumber:', error)
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
