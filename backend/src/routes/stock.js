import express from 'express'
import {
  getPendingStock,
  generateBarcode,
  confirmPendingItem,
  deletePendingItem,
  getStock,
  getStockByBarcode,
  generateBarcodeNumber,
  updateStockQuantity,
  deleteStockItem,
} from '../controllers/stockController.js'

const router = express.Router()

// Rutas de stock pendiente
router.get('/pending', getPendingStock)
router.put('/pending/:id/generate-barcode', generateBarcode)
router.put('/pending/:id/confirm', confirmPendingItem)
router.delete('/pending/:id', deletePendingItem)

// Rutas de stock
router.get('/', getStock)
router.get('/barcode/:barcode', getStockByBarcode)
router.get('/generate-barcode', generateBarcodeNumber)
router.put('/:id/quantity', updateStockQuantity)
router.delete('/:id', deleteStockItem)

export default router
