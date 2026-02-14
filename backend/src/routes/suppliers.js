import express from 'express'
import multer from 'multer'
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
  getPendingInvoices,
  processBarcode,
} from '../controllers/suppliersController.js'
import { processInvoiceImage } from '../controllers/invoiceOCRController.js'

const router = express.Router()

// Configurar multer para manejar carga de archivos en memoria
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB máximo
  },
  fileFilter: (req, file, cb) => {
    // Aceptar solo imágenes y PDFs
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true)
    } else {
      cb(new Error('Solo se permiten archivos de imagen (JPG, PNG) o PDF'), false)
    }
  },
})

// Ruta para procesar código de barras (debe ir antes de otras rutas)
router.post('/process-barcode', processBarcode)

// Ruta para procesar imagen completa de factura con OCR
router.post('/process-invoice-image', upload.single('image'), processInvoiceImage)

// Rutas de facturas (DEBEN IR ANTES de las rutas con parámetros dinámicos)
router.post('/invoices', createInvoice)
router.get('/invoices', getInvoices)
router.get('/invoices/pending', getPendingInvoices)
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
