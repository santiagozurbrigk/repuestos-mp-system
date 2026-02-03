import express from 'express'
import {
  createSupplier,
  getSuppliers,
  getSupplierById,
  updateSupplier,
  deleteSupplier,
  createInvoice,
  getInvoices,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
  getSupplierSummary,
  processBarcode,
} from '../controllers/suppliersController.js'

const router = express.Router()

// Ruta para procesar código de barras (debe ir antes de otras rutas)
router.post('/process-barcode', processBarcode)

// Rutas de facturas (DEBEN IR ANTES de las rutas con parámetros dinámicos)
router.post('/invoices', createInvoice)
router.get('/invoices', getInvoices)
router.get('/invoices/:invoice_id', getInvoiceById)
router.put('/invoices/:invoice_id', updateInvoice)
router.delete('/invoices/:invoice_id', deleteInvoice)

// Rutas de proveedores
router.post('/', createSupplier)
router.get('/', getSuppliers)

// Rutas con parámetros dinámicos (DEBEN IR AL FINAL)
router.get('/:supplier_id/summary', getSupplierSummary)
router.post('/:supplier_id/invoices', createInvoice)
router.get('/:supplier_id/invoices', getInvoices)
router.get('/:supplier_id/invoices/:invoice_id', getInvoiceById)
router.put('/:supplier_id/invoices/:invoice_id', updateInvoice)
router.delete('/:supplier_id/invoices/:invoice_id', deleteInvoice)
router.get('/:id', getSupplierById)
router.put('/:id', updateSupplier)
router.delete('/:id', deleteSupplier)

export default router
