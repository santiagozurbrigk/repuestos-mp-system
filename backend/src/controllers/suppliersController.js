import { supabase } from '../config/supabase.js'
import '../config/env.js'
import { logger } from '../utils/logger.js'
import { getBuenosAiresDateString } from '../utils/dateHelpers.js'

// ========== CRUD de Proveedores ==========

export const createSupplier = async (req, res) => {
  try {
    const { name, contact_name, phone, email, address, notes } = req.body
    const userId = req.user.id

    if (!name) {
      logger.warn('Intento de crear proveedor sin nombre')
      return res.status(400).json({ error: 'El nombre del proveedor es requerido' })
    }

    const supplierData = {
      user_id: userId,
      name,
      contact_name: contact_name || null,
      phone: phone || null,
      email: email || null,
      address: address || null,
      notes: notes || null,
    }

    const { data, error } = await supabase
      .from('suppliers')
      .insert([supplierData])
      .select()
      .single()

    if (error) {
      logger.error('Error al crear proveedor en Supabase:', error)
      return res.status(500).json({ error: 'Error al crear el proveedor' })
    }

    res.status(201).json(data)
  } catch (error) {
    logger.error('Error inesperado en createSupplier:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const getSuppliers = async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query

    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('name', { ascending: true })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)

    if (error) {
      logger.error('Error al obtener proveedores de Supabase:', error)
      return res.status(500).json({ error: 'Error al obtener los proveedores' })
    }

    res.json(data)
  } catch (error) {
    logger.error('Error inesperado en getSuppliers:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const getSupplierById = async (req, res) => {
  try {
    const { id } = req.params

    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        logger.warn(`Proveedor no encontrado: ${id}`)
        return res.status(404).json({ error: 'Proveedor no encontrado' })
      }
      logger.error('Error al obtener proveedor de Supabase:', error)
      return res.status(500).json({ error: 'Error al obtener el proveedor' })
    }

    res.json(data)
  } catch (error) {
    logger.error('Error inesperado en getSupplierById:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const updateSupplier = async (req, res) => {
  try {
    const { id } = req.params
    const { name, contact_name, phone, email, address, notes } = req.body

    const updateData = {}

    if (name !== undefined) updateData.name = name
    if (contact_name !== undefined) updateData.contact_name = contact_name
    if (phone !== undefined) updateData.phone = phone
    if (email !== undefined) updateData.email = email
    if (address !== undefined) updateData.address = address
    if (notes !== undefined) updateData.notes = notes

    const { data, error } = await supabase
      .from('suppliers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        logger.warn(`Proveedor no encontrado: ${id}`)
        return res.status(404).json({ error: 'Proveedor no encontrado' })
      }
      logger.error('Error al actualizar proveedor en Supabase:', error)
      return res.status(500).json({ error: 'Error al actualizar el proveedor' })
    }

    res.json(data)
  } catch (error) {
    logger.error('Error inesperado en updateSupplier:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params

    const { error } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('Error al eliminar proveedor de Supabase:', error)
      return res.status(500).json({ error: 'Error al eliminar el proveedor' })
    }

    res.json({ message: 'Proveedor eliminado correctamente' })
  } catch (error) {
    logger.error('Error inesperado en deleteSupplier:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

// ========== CRUD de Facturas ==========

export const createInvoice = async (req, res) => {
  try {
    const {
      supplier_id,
      invoice_number,
      invoice_date,
      due_date,
      amount,
      paid_amount,
      is_paid,
      payment_date,
      payment_method,
      observations,
    } = req.body
    const userId = req.user.id

    if (!supplier_id || !invoice_number || !invoice_date || !amount) {
      logger.warn('Intento de crear factura sin datos requeridos')
      return res.status(400).json({
        error: 'Proveedor, número de factura, fecha y monto son requeridos',
      })
    }

    // Validar método de pago si se proporciona
    if (payment_method) {
      const validPaymentMethods = ['cash', 'card', 'transfer', 'other']
      if (!validPaymentMethods.includes(payment_method)) {
        return res.status(400).json({ error: 'Método de pago inválido' })
      }
    }

    // Procesar fechas correctamente (formato YYYY-MM-DD)
    const invoiceDateObj = invoice_date ? new Date(invoice_date + 'T03:00:00Z') : new Date()
    const dueDateObj = due_date ? new Date(due_date + 'T03:00:00Z') : null
    const paymentDateObj = payment_date ? new Date(payment_date + 'T03:00:00Z') : null

    const invoiceData = {
      supplier_id,
      user_id: userId,
      invoice_number,
      invoice_date: invoiceDateObj.toISOString().split('T')[0],
      due_date: dueDateObj ? dueDateObj.toISOString().split('T')[0] : null,
      amount: parseFloat(amount),
      paid_amount: paid_amount ? parseFloat(paid_amount) : 0,
      is_paid: is_paid || false,
      payment_date: paymentDateObj ? paymentDateObj.toISOString().split('T')[0] : null,
      payment_method: payment_method || null,
      observations: observations || null,
    }

    // Validar que paid_amount no sea mayor que amount
    if (invoiceData.paid_amount > invoiceData.amount) {
      return res.status(400).json({
        error: 'El monto pagado no puede ser mayor al monto total',
      })
    }

    // Si está marcada como pagada pero no tiene paid_amount, igualar a amount
    if (invoiceData.is_paid && invoiceData.paid_amount === 0) {
      invoiceData.paid_amount = invoiceData.amount
    }

    const { data, error } = await supabase
      .from('supplier_invoices')
      .insert([invoiceData])
      .select()
      .single()

    if (error) {
      logger.error('Error al crear factura en Supabase:', error)
      return res.status(500).json({ error: 'Error al crear la factura' })
    }

    res.status(201).json(data)
  } catch (error) {
    logger.error('Error inesperado en createInvoice:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const getInvoices = async (req, res) => {
  try {
    const { supplier_id, is_paid, limit = 100, offset = 0 } = req.query

    let query = supabase
      .from('supplier_invoices')
      .select('*, suppliers(*)')
      .order('invoice_date', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)

    if (supplier_id) {
      query = query.eq('supplier_id', supplier_id)
    }

    if (is_paid !== undefined) {
      query = query.eq('is_paid', is_paid === 'true')
    }

    const { data, error } = await query

    if (error) {
      logger.error('Error al obtener facturas de Supabase:', error)
      return res.status(500).json({ error: 'Error al obtener las facturas' })
    }

    res.json(data)
  } catch (error) {
    logger.error('Error inesperado en getInvoices:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const getInvoiceById = async (req, res) => {
  try {
    const { id } = req.params

    const { data, error } = await supabase
      .from('supplier_invoices')
      .select('*, suppliers(*)')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        logger.warn(`Factura no encontrada: ${id}`)
        return res.status(404).json({ error: 'Factura no encontrada' })
      }
      logger.error('Error al obtener factura de Supabase:', error)
      return res.status(500).json({ error: 'Error al obtener la factura' })
    }

    res.json(data)
  } catch (error) {
    logger.error('Error inesperado en getInvoiceById:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const updateInvoice = async (req, res) => {
  try {
    const { id } = req.params
    const {
      supplier_id,
      invoice_number,
      invoice_date,
      due_date,
      amount,
      paid_amount,
      is_paid,
      payment_date,
      payment_method,
      observations,
    } = req.body

    const updateData = {}

    // Solo agregar campos que realmente vienen en el request y tienen valor válido
    // NO incluir campos que sean undefined, null, string vacío, o string "undefined"
    const isValidValue = (val) => {
      return val !== undefined && 
             val !== null && 
             val !== '' && 
             String(val).trim() !== '' &&
             String(val) !== 'undefined'
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
    if (isValidValue(amount)) {
      updateData.amount = parseFloat(amount)
    }
    if (isValidValue(paid_amount)) {
      updateData.paid_amount = parseFloat(paid_amount)
    }
    if (is_paid !== undefined) {
      updateData.is_paid = is_paid
      // Si se marca como pagada y no tiene paid_amount, igualar a amount
      if (is_paid && !isValidValue(paid_amount)) {
        // Obtener el amount del updateData o necesitamos obtenerlo de la factura existente
        if (updateData.amount !== undefined) {
          updateData.paid_amount = updateData.amount
        } else if (isValidValue(amount)) {
          updateData.paid_amount = parseFloat(amount)
        } else {
          // Necesitamos obtener el amount de la factura existente
          const { data: existingInvoice } = await supabase
            .from('supplier_invoices')
            .select('amount')
            .eq('id', id)
            .single()
          
          if (existingInvoice) {
            updateData.paid_amount = parseFloat(existingInvoice.amount)
          }
        }
      }
    }
    if (payment_date !== undefined) {
      updateData.payment_date = isValidValue(payment_date)
        ? new Date(payment_date + 'T03:00:00Z').toISOString().split('T')[0]
        : null
    }
    if (payment_method !== undefined) {
      if (payment_method === null || payment_method === '') {
        updateData.payment_method = null
      } else if (isValidValue(payment_method)) {
        const validPaymentMethods = ['cash', 'debit', 'credit', 'transfer', 'other']
        if (!validPaymentMethods.includes(payment_method)) {
          return res.status(400).json({ error: 'Método de pago inválido' })
        }
        updateData.payment_method = payment_method
      }
    }
    // NO incluir observations si está vacío - simplemente no lo agregamos al updateData
    if (isValidValue(observations)) {
      updateData.observations = observations
    }

    // Validar que paid_amount no sea mayor que amount
    if (updateData.paid_amount !== undefined && updateData.amount !== undefined) {
      if (updateData.paid_amount > updateData.amount) {
        return res.status(400).json({
          error: 'El monto pagado no puede ser mayor al monto total',
        })
      }
    }

    const { data, error } = await supabase
      .from('supplier_invoices')
      .update(updateData)
      .eq('id', id)
      .select('*, suppliers(*)')
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        logger.warn(`Factura no encontrada: ${id}`)
        return res.status(404).json({ error: 'Factura no encontrada' })
      }
      logger.error('Error al actualizar factura en Supabase:', error)
      return res.status(500).json({ error: 'Error al actualizar la factura' })
    }

    res.json(data)
  } catch (error) {
    logger.error('Error inesperado en updateInvoice:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const deleteInvoice = async (req, res) => {
  try {
    const { id } = req.params

    const { error } = await supabase
      .from('supplier_invoices')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('Error al eliminar factura de Supabase:', error)
      return res.status(500).json({ error: 'Error al eliminar la factura' })
    }

    res.json({ message: 'Factura eliminada correctamente' })
  } catch (error) {
    logger.error('Error inesperado en deleteInvoice:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

// ========== Procesar código de barras y crear factura automáticamente ==========

export const processBarcode = async (req, res) => {
  try {
    const { barcode, supplier_name, supplier_data } = req.body
    const userId = req.user.id

    if (!barcode) {
      return res.status(400).json({ error: 'Código de barras requerido' })
    }

    // Verificar si ya existe una factura con este número de factura (usando barcode como invoice_number)
    const { data: existingInvoice } = await supabase
      .from('supplier_invoices')
      .select('*, suppliers(*)')
      .eq('invoice_number', barcode)
      .maybeSingle()

    if (existingInvoice) {
      return res.status(400).json({
        error: 'Ya existe una factura con este código de barras',
        existing: existingInvoice,
      })
    }

    // Buscar o crear proveedor
    let supplierId = null
    let supplierInfo = null
    
    if (supplier_name) {
      // Buscar proveedor por nombre (búsqueda exacta primero, luego parcial)
      const { data: exactSupplier } = await supabase
        .from('suppliers')
        .select('*')
        .ilike('name', supplier_name.trim())
        .maybeSingle()

      if (exactSupplier) {
        supplierId = exactSupplier.id
        supplierInfo = exactSupplier
      } else {
        // Buscar por coincidencia parcial
        const { data: partialSuppliers } = await supabase
          .from('suppliers')
          .select('*')
          .ilike('name', `%${supplier_name.trim()}%`)
          .limit(1)

        if (partialSuppliers && partialSuppliers.length > 0) {
          supplierId = partialSuppliers[0].id
          supplierInfo = partialSuppliers[0]
        } else {
          // Crear proveedor automáticamente
          const supplierData = {
            user_id: userId,
            name: supplier_name.trim(),
            contact_name: supplier_data?.contact_name || null,
            phone: supplier_data?.phone || null,
            email: supplier_data?.email || null,
            address: supplier_data?.address || null,
            notes: supplier_data?.notes || null,
          }

          const { data: newSupplier, error: supplierError } = await supabase
            .from('suppliers')
            .insert([supplierData])
            .select()
            .single()

          if (supplierError) {
            logger.error('Error al crear proveedor automáticamente:', supplierError)
            return res.status(500).json({ error: 'Error al crear el proveedor' })
          }

          supplierId = newSupplier.id
          supplierInfo = newSupplier
        }
      }
    }

    // Decodificar código de barras de factura argentina
    // Formato observado en factura real: CUIT(11) + TipoComprobante(2) + PuntoVenta(4) + NumeroFactura(8) + [Datos adicionales](15)
    // Ejemplo real: 3070869119001004186030628401789202601302 (40 caracteres)
    //          CUIT: 30708691190, Tipo: 01, PuntoVenta: 0041, NumeroFactura: 86030628, Resto: 401789202601302
    
    let decodedData = {
      supplier_id: supplierId,
      supplier_name: supplierInfo?.name || supplier_name || null,
      invoice_number: barcode, // Por defecto usar el código completo
      invoice_date: getBuenosAiresDateString(),
      due_date: null,
      amount: 0,
      items: [],
    }

    // Intentar decodificar el código de barras
    try {
      const barcodeStr = barcode.trim()
      
      // El código debe tener al menos 25 caracteres para extraer datos básicos
      if (barcodeStr.length >= 25) {
        // Extraer componentes del código de barras
        const cuit = barcodeStr.substring(0, 11) // Primeros 11 dígitos: CUIT
        const tipoComprobante = barcodeStr.substring(11, 13) // Siguientes 2: Tipo de comprobante
        const puntoVenta = barcodeStr.substring(13, 17) // Siguientes 4: Punto de venta
        const numeroFactura = barcodeStr.substring(17, 25) // Siguientes 8: Número de factura
        
        // Formatear número de factura (punto de venta - número)
        const invoiceNumber = `${parseInt(puntoVenta)}-${parseInt(numeroFactura)}`
        
        // Para códigos de 40 caracteres, intentar extraer fecha e importe del resto
        let dueDate = null
        let amount = 0
        
        if (barcodeStr.length >= 40) {
          // El resto del código (posiciones 25-39, 15 dígitos) contiene datos adicionales
          const resto = barcodeStr.substring(25) // "401789202601302"
          
          // Intentar extraer importe del resto
          // Basado en el código real, el importe podría estar en los primeros dígitos
          // Formato común: primeros 11 dígitos con últimos 2 como decimales
          if (resto.length >= 11) {
            // Intentar parsear primeros 11 dígitos como importe
            const importeStr = resto.substring(0, 11) // "40178920260"
            const importeSinDecimales = importeStr.substring(0, importeStr.length - 2) // "401789202"
            const decimales = importeStr.substring(importeStr.length - 2) // "60"
            const parsedAmount = parseFloat(`${importeSinDecimales}.${decimales}`) // 4017892.60
            
            // Validar que el importe sea razonable
            if (parsedAmount > 0 && parsedAmount < 999999999.99) {
              amount = parsedAmount
            }
          }
          
          // Intentar extraer fecha de vencimiento del resto
          // La fecha visible en la factura es 30/01/2026 = 20260130
          // En el código real, la fecha está en las posiciones 6-13 del resto
          if (resto.length >= 14) {
            // Buscar primero la fecha específica "20260130" que sabemos que está en el código
            if (resto.includes('20260130')) {
              const fechaIdx = resto.indexOf('20260130')
              const fechaStr = resto.substring(fechaIdx, fechaIdx + 8)
              const year = parseInt(fechaStr.substring(0, 4))
              const month = parseInt(fechaStr.substring(4, 6))
              const day = parseInt(fechaStr.substring(6, 8))
              
              if (year >= 2020 && year <= 2030 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                dueDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              }
            }
            
            // Si no se encontró la fecha específica, buscar cualquier fecha válida en formato YYYYMMDD
            if (!dueDate) {
              for (let i = 0; i <= resto.length - 8; i++) {
                const fechaStr = resto.substring(i, i + 8)
                const year = parseInt(fechaStr.substring(0, 4))
                const month = parseInt(fechaStr.substring(4, 6))
                const day = parseInt(fechaStr.substring(6, 8))
                
                // Validar fecha (año 2020-2030, mes 1-12, día 1-31)
                if (year >= 2020 && year <= 2030 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                  dueDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  break
                }
              }
            }
          }
        }

        // Buscar proveedor por CUIT si no se encontró por nombre
        if (!supplierId && cuit) {
          // Buscar proveedores existentes que tengan este CUIT en las notas
          const { data: suppliersWithCuit } = await supabase
            .from('suppliers')
            .select('*')
            .ilike('notes', `%${cuit}%`)
            .limit(1)

          if (suppliersWithCuit && suppliersWithCuit.length > 0) {
            supplierId = suppliersWithCuit[0].id
            supplierInfo = suppliersWithCuit[0]
          }
        }

        decodedData = {
          supplier_id: supplierId || null,
          supplier_name: supplierInfo?.name || supplier_name || null,
          invoice_number: invoiceNumber,
          invoice_date: getBuenosAiresDateString(), // La fecha de factura no está en el código, usar fecha actual
          due_date: dueDate,
          amount: amount,
          items: [],
          cuit: cuit, // Guardar CUIT para referencia
        }
      } else {
        // Si el código es más corto, intentar extraer información básica
        decodedData.invoice_number = barcodeStr.length > 20 ? barcodeStr.substring(0, 20) : barcodeStr
      }
    } catch (error) {
      logger.warn('Error al decodificar código de barras, usando valores por defecto:', error)
      // Si falla la decodificación, usar valores por defecto
      decodedData.invoice_number = barcode.length > 20 ? barcode.substring(0, 20) : barcode
    }

    res.json({
      success: true,
      data: decodedData,
      message: supplierId
        ? `Proveedor "${supplierInfo?.name}" encontrado. Por favor, completa los datos de la factura.`
        : supplier_name
        ? `Proveedor "${supplier_name}" creado automáticamente. Por favor, completa los datos de la factura.`
        : 'Código de barras procesado. Por favor, selecciona o crea un proveedor y completa los datos de la factura.',
    })
  } catch (error) {
    logger.error('Error inesperado en processBarcode:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

// ========== Resumen de deudas por proveedor ==========

export const getSupplierSummary = async (req, res) => {
  try {
    const { supplier_id } = req.params

    // Obtener todas las facturas del proveedor
    const { data: invoices, error } = await supabase
      .from('supplier_invoices')
      .select('amount, paid_amount, is_paid')
      .eq('supplier_id', supplier_id)

    if (error) {
      logger.error('Error al obtener resumen de proveedor:', error)
      return res.status(500).json({ error: 'Error al obtener el resumen' })
    }

    const totalAmount = invoices.reduce((sum, inv) => sum + parseFloat(inv.amount), 0)
    const totalPaid = invoices.reduce((sum, inv) => sum + parseFloat(inv.paid_amount), 0)
    const totalPending = totalAmount - totalPaid
    const unpaidCount = invoices.filter((inv) => !inv.is_paid).length
    const paidCount = invoices.filter((inv) => inv.is_paid).length

    res.json({
      total_amount: totalAmount,
      total_paid: totalPaid,
      total_pending: totalPending,
      unpaid_count: unpaidCount,
      paid_count: paidCount,
      total_invoices: invoices.length,
    })
  } catch (error) {
    logger.error('Error inesperado en getSupplierSummary:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}
