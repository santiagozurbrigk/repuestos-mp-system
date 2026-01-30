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

    // Solo agregar campos que realmente vienen en el request (no undefined)
    if (supplier_id !== undefined && supplier_id !== null) updateData.supplier_id = supplier_id
    if (invoice_number !== undefined && invoice_number !== null) updateData.invoice_number = invoice_number
    if (invoice_date !== undefined && invoice_date !== null) {
      const invoiceDateObj = new Date(invoice_date + 'T03:00:00Z')
      updateData.invoice_date = invoiceDateObj.toISOString().split('T')[0]
    }
    if (due_date !== undefined) {
      updateData.due_date = due_date ? new Date(due_date + 'T03:00:00Z').toISOString().split('T')[0] : null
    }
    if (amount !== undefined && amount !== null) updateData.amount = parseFloat(amount)
    if (paid_amount !== undefined && paid_amount !== null) {
      updateData.paid_amount = parseFloat(paid_amount)
    }
    if (is_paid !== undefined) {
      updateData.is_paid = is_paid
      // Si se marca como pagada y no tiene paid_amount, igualar a amount
      if (is_paid && (paid_amount === undefined || paid_amount === null || paid_amount === 0)) {
        // Obtener el amount del updateData o necesitamos obtenerlo de la factura existente
        if (updateData.amount !== undefined) {
          updateData.paid_amount = updateData.amount
        } else if (amount !== undefined) {
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
      updateData.payment_date = payment_date
        ? new Date(payment_date + 'T03:00:00Z').toISOString().split('T')[0]
        : null
    }
    if (payment_method !== undefined) {
      if (payment_method) {
        const validPaymentMethods = ['cash', 'card', 'transfer', 'other']
        if (!validPaymentMethods.includes(payment_method)) {
          return res.status(400).json({ error: 'Método de pago inválido' })
        }
      }
      updateData.payment_method = payment_method
    }
    if (observations !== undefined) updateData.observations = observations

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
