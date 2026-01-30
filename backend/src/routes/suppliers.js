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
} from '../controllers/suppliersController.js'

const router = express.Router()

// Rutas de proveedores
router.post('/', createSupplier)
router.get('/', getSuppliers)
router.get('/:id', getSupplierById)
router.put('/:id', updateSupplier)
router.delete('/:id', deleteSupplier)

// Rutas de facturas
router.post('/:supplier_id/invoices', createInvoice)
router.get('/:supplier_id/invoices', getInvoices)
router.get('/:supplier_id/invoices/:invoice_id', getInvoiceById)
router.put('/:supplier_id/invoices/:invoice_id', updateInvoice)
router.delete('/:supplier_id/invoices/:invoice_id', deleteInvoice)

// Resumen de proveedor
router.get('/:supplier_id/summary', getSupplierSummary)

// Rutas alternativas para facturas (sin supplier_id en la ruta)
router.post('/invoices', createInvoice)
router.get('/invoices', getInvoices)
router.get('/invoices/:invoice_id', getInvoiceById)
router.put('/invoices/:invoice_id', updateInvoice)
router.delete('/invoices/:invoice_id', deleteInvoice)

export default router
