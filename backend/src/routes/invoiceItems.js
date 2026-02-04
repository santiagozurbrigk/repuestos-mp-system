import express from 'express'
import {
  createInvoiceItem,
  getInvoiceItems,
  updateInvoiceItem,
  deleteInvoiceItem,
  createBulkInvoiceItems,
} from '../controllers/invoiceItemsController.js'

const router = express.Router()

// Crear múltiples items a la vez (para cuando se procesa una factura completa)
router.post('/bulk', createBulkInvoiceItems)

// Rutas CRUD de items
router.post('/', createInvoiceItem)
router.get('/invoice/:invoice_id', getInvoiceItems)
router.put('/:id', updateInvoiceItem)
router.delete('/:id', deleteInvoiceItem)

export default router
