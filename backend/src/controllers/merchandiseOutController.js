import { supabase } from '../config/supabase.js'
import '../config/env.js'
import { logger } from '../utils/logger.js'
import { getBuenosAiresDateString } from '../utils/dateHelpers.js'

// ========== CRUD de Egresos de Mercadería ==========

export const createMerchandiseOut = async (req, res) => {
  try {
    const {
      supplier_id,
      barcode,
      invoice_number,
      invoice_date,
      due_date,
      total_amount,
      items,
      is_paid,
      payment_date,
      payment_method,
      observations,
    } = req.body
    const userId = req.user.id

    if (!barcode || !invoice_number || !invoice_date || !total_amount) {
      logger.warn('Intento de crear egreso sin datos requeridos')
      return res.status(400).json({
        error: 'Código de barras, número de factura, fecha y monto total son requeridos',
      })
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'Debe incluir al menos un producto en la factura',
      })
    }

    // Validar método de pago si se proporciona
    if (payment_method) {
      const validPaymentMethods = ['cash', 'debit', 'credit', 'transfer']
      if (!validPaymentMethods.includes(payment_method)) {
        return res.status(400).json({ error: 'Método de pago inválido' })
      }
    }

    // Procesar fechas correctamente (formato YYYY-MM-DD)
    const invoiceDateObj = invoice_date ? new Date(invoice_date + 'T03:00:00Z') : new Date()
    const dueDateObj = due_date ? new Date(due_date + 'T03:00:00Z') : null
    const paymentDateObj = payment_date ? new Date(payment_date + 'T03:00:00Z') : null

    // Verificar si ya existe un egreso con este código de barras
    const { data: existing } = await supabase
      .from('merchandise_out')
      .select('id')
      .eq('barcode', barcode)
      .maybeSingle()

    if (existing) {
      return res.status(400).json({
        error: 'Ya existe un egreso registrado con este código de barras',
      })
    }

    // Crear el egreso
    const merchandiseOutData = {
      user_id: userId,
      supplier_id: supplier_id || null,
      barcode,
      invoice_number,
      invoice_date: invoiceDateObj.toISOString().split('T')[0],
      due_date: dueDateObj ? dueDateObj.toISOString().split('T')[0] : null,
      total_amount: parseFloat(total_amount),
      is_paid: is_paid || false,
      payment_date: paymentDateObj ? paymentDateObj.toISOString().split('T')[0] : null,
      payment_method: payment_method || null,
      observations: observations || null,
    }

    const { data: merchandiseOut, error: merchandiseError } = await supabase
      .from('merchandise_out')
      .insert([merchandiseOutData])
      .select()
      .single()

    if (merchandiseError) {
      logger.error('Error al crear egreso en Supabase:', merchandiseError)
      return res.status(500).json({ error: 'Error al crear el egreso de mercadería' })
    }

    // Crear los items del egreso
    const itemsData = items.map((item) => ({
      merchandise_out_id: merchandiseOut.id,
      product_name: item.product_name,
      product_code: item.product_code || null,
      quantity: parseFloat(item.quantity || 1),
      unit_price: parseFloat(item.unit_price || 0),
      total_price: parseFloat(item.total_price || item.unit_price * item.quantity || 0),
      brand: item.brand || null,
      observations: item.observations || null,
    }))

    const { error: itemsError } = await supabase
      .from('merchandise_out_items')
      .insert(itemsData)

    if (itemsError) {
      // Si falla la inserción de items, eliminar el egreso creado
      await supabase.from('merchandise_out').delete().eq('id', merchandiseOut.id)
      logger.error('Error al crear items del egreso:', itemsError)
      return res.status(500).json({ error: 'Error al crear los productos del egreso' })
    }

    // Obtener el egreso completo con items
    const { data: completeMerchandiseOut, error: fetchError } = await supabase
      .from('merchandise_out')
      .select('*, merchandise_out_items(*), suppliers(*)')
      .eq('id', merchandiseOut.id)
      .single()

    if (fetchError) {
      logger.error('Error al obtener egreso completo:', fetchError)
      return res.status(500).json({ error: 'Error al obtener el egreso completo' })
    }

    res.status(201).json(completeMerchandiseOut)
  } catch (error) {
    logger.error('Error inesperado en createMerchandiseOut:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const getMerchandiseOut = async (req, res) => {
  try {
    const { supplier_id, startDate, endDate, limit = 100, offset = 0 } = req.query

    let query = supabase
      .from('merchandise_out')
      .select('*, merchandise_out_items(*), suppliers(*)')
      .order('scanned_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)

    if (supplier_id) {
      query = query.eq('supplier_id', supplier_id)
    }

    if (startDate) {
      query = query.gte('invoice_date', startDate)
    }

    if (endDate) {
      query = query.lte('invoice_date', endDate)
    }

    const { data, error } = await query

    if (error) {
      logger.error('Error al obtener egresos de Supabase:', error)
      return res.status(500).json({ error: 'Error al obtener los egresos de mercadería' })
    }

    res.json(data)
  } catch (error) {
    logger.error('Error inesperado en getMerchandiseOut:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const getMerchandiseOutById = async (req, res) => {
  try {
    const { id } = req.params

    const { data, error } = await supabase
      .from('merchandise_out')
      .select('*, merchandise_out_items(*), suppliers(*)')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        logger.warn(`Egreso no encontrado: ${id}`)
        return res.status(404).json({ error: 'Egreso de mercadería no encontrado' })
      }
      logger.error('Error al obtener egreso de Supabase:', error)
      return res.status(500).json({ error: 'Error al obtener el egreso de mercadería' })
    }

    res.json(data)
  } catch (error) {
    logger.error('Error inesperado en getMerchandiseOutById:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const getMerchandiseOutByBarcode = async (req, res) => {
  try {
    const { barcode } = req.params

    const { data, error } = await supabase
      .from('merchandise_out')
      .select('*, merchandise_out_items(*), suppliers(*)')
      .eq('barcode', barcode)
      .maybeSingle()

    if (error) {
      logger.error('Error al buscar egreso por código de barras:', error)
      return res.status(500).json({ error: 'Error al buscar el egreso' })
    }

    if (data) {
      res.json(data)
    } else {
      res.status(404).json({ error: 'No se encontró un egreso con este código de barras' })
    }
  } catch (error) {
    logger.error('Error inesperado en getMerchandiseOutByBarcode:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const updateMerchandiseOut = async (req, res) => {
  try {
    const { id } = req.params
    const {
      supplier_id,
      invoice_number,
      invoice_date,
      due_date,
      total_amount,
      items,
      is_paid,
      payment_date,
      payment_method,
      observations,
    } = req.body

    const updateData = {}

    const isValidValue = (val) => {
      return val !== undefined && val !== null && val !== '' && String(val).trim() !== '' && String(val) !== 'undefined'
    }

    if (isValidValue(supplier_id)) {
      updateData.supplier_id = supplier_id
    }
    if (isValidValue(invoice_number)) {
      updateData.invoice_number = invoice_number
    }
    if (isValidValue(invoice_date)) {
      const invoiceDateObj = new Date(invoice_date + 'T03:00:00Z')
      updateData.invoice_date = invoiceDateObj.toISOString().split('T')[0]
    }
    if (due_date !== undefined) {
      updateData.due_date = isValidValue(due_date)
        ? new Date(due_date + 'T03:00:00Z').toISOString().split('T')[0]
        : null
    }
    if (isValidValue(total_amount)) {
      updateData.total_amount = parseFloat(total_amount)
    }
    if (is_paid !== undefined) {
      updateData.is_paid = is_paid
    }
    if (payment_date !== undefined) {
      updateData.payment_date = isValidValue(payment_date)
        ? new Date(payment_date + 'T03:00:00Z').toISOString().split('T')[0]
        : null
    }
    if (isValidValue(payment_method)) {
      const validPaymentMethods = ['cash', 'debit', 'credit', 'transfer']
      if (!validPaymentMethods.includes(payment_method)) {
        return res.status(400).json({ error: 'Método de pago inválido' })
      }
      updateData.payment_method = payment_method
    }
    if (isValidValue(observations)) {
      updateData.observations = observations
    }

    // Actualizar el egreso
    const { data: merchandiseOut, error: updateError } = await supabase
      .from('merchandise_out')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        logger.warn(`Egreso no encontrado: ${id}`)
        return res.status(404).json({ error: 'Egreso de mercadería no encontrado' })
      }
      logger.error('Error al actualizar egreso en Supabase:', updateError)
      return res.status(500).json({ error: 'Error al actualizar el egreso de mercadería' })
    }

    // Si se proporcionan items, actualizarlos
    if (items && Array.isArray(items)) {
      // Eliminar items existentes
      await supabase.from('merchandise_out_items').delete().eq('merchandise_out_id', id)

      // Crear nuevos items
      if (items.length > 0) {
        const itemsData = items.map((item) => ({
          merchandise_out_id: id,
          product_name: item.product_name,
          product_code: item.product_code || null,
          quantity: parseFloat(item.quantity || 1),
          unit_price: parseFloat(item.unit_price || 0),
          total_price: parseFloat(item.total_price || item.unit_price * item.quantity || 0),
          brand: item.brand || null,
          observations: item.observations || null,
        }))

        const { error: itemsError } = await supabase
          .from('merchandise_out_items')
          .insert(itemsData)

        if (itemsError) {
          logger.error('Error al actualizar items del egreso:', itemsError)
          return res.status(500).json({ error: 'Error al actualizar los productos del egreso' })
        }
      }
    }

    // Obtener el egreso completo con items actualizados
    const { data: completeMerchandiseOut, error: fetchError } = await supabase
      .from('merchandise_out')
      .select('*, merchandise_out_items(*), suppliers(*)')
      .eq('id', id)
      .single()

    if (fetchError) {
      logger.error('Error al obtener egreso completo:', fetchError)
      return res.status(500).json({ error: 'Error al obtener el egreso completo' })
    }

    res.json(completeMerchandiseOut)
  } catch (error) {
    logger.error('Error inesperado en updateMerchandiseOut:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const deleteMerchandiseOut = async (req, res) => {
  try {
    const { id } = req.params

    const { error } = await supabase
      .from('merchandise_out')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('Error al eliminar egreso de Supabase:', error)
      return res.status(500).json({ error: 'Error al eliminar el egreso de mercadería' })
    }

    res.json({ message: 'Egreso de mercadería eliminado correctamente' })
  } catch (error) {
    logger.error('Error inesperado en deleteMerchandiseOut:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

// ========== Función para procesar código de barras y extraer datos ==========
// NOTA: Esta función es un placeholder. En producción, necesitarás integrar
// con un servicio que decodifique el código de barras de la factura.
// Los códigos de barras de facturas pueden tener diferentes formatos según el proveedor.

export const processBarcode = async (req, res) => {
  try {
    const { barcode } = req.body

    if (!barcode) {
      return res.status(400).json({ error: 'Código de barras requerido' })
    }

    // Verificar si ya existe un egreso con este código
    const { data: existing } = await supabase
      .from('merchandise_out')
      .select('*')
      .eq('barcode', barcode)
      .maybeSingle()

    if (existing) {
      return res.status(400).json({
        error: 'Este código de barras ya fue escaneado',
        existing: existing,
      })
    }

    // TODO: Aquí deberías integrar con un servicio que decodifique el código de barras
    // Por ahora, retornamos una estructura de ejemplo
    // En producción, esto debería llamar a una API del proveedor o servicio de facturación
    // que pueda decodificar el código de barras y extraer la información

    // Ejemplo de respuesta (esto debe ser reemplazado con la lógica real de decodificación)
    const decodedData = {
      barcode,
      invoice_number: barcode.substring(0, 10) || 'N/A', // Ejemplo
      invoice_date: getBuenosAiresDateString(),
      due_date: null, // Se calcularía según el proveedor
      total_amount: 0, // Se calcularía desde los items
      supplier_id: null, // Se identificaría desde el código
      items: [
        // Ejemplo de items - estos deberían venir del código de barras decodificado
        {
          product_name: 'Producto ejemplo',
          product_code: 'PROD001',
          quantity: 1,
          unit_price: 0,
          total_price: 0,
        },
      ],
    }

    res.json({
      success: true,
      data: decodedData,
      message: 'Código de barras procesado. Por favor, verifica y completa la información.',
    })
  } catch (error) {
    logger.error('Error inesperado en processBarcode:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}
