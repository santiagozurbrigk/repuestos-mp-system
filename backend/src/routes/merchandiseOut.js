import express from 'express'
import {
  createMerchandiseOut,
  getMerchandiseOut,
  getMerchandiseOutById,
  getMerchandiseOutByBarcode,
  updateMerchandiseOut,
  deleteMerchandiseOut,
  processBarcode,
} from '../controllers/merchandiseOutController.js'

const router = express.Router()

// Ruta para procesar código de barras (debe ir antes de /:id)
router.post('/process-barcode', processBarcode)

// Rutas CRUD
router.post('/', createMerchandiseOut)
router.get('/', getMerchandiseOut)
router.get('/barcode/:barcode', getMerchandiseOutByBarcode)
router.get('/:id', getMerchandiseOutById)
router.put('/:id', updateMerchandiseOut)
router.delete('/:id', deleteMerchandiseOut)

export default router
