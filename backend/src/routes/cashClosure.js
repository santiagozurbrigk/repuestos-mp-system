import express from 'express'
import {
  getCashClosures,
  getCashClosureByDate,
  createCashClosure,
  getTodaySalesSummary,
  updateCashClosure,
  deleteCashClosure,
} from '../controllers/cashClosureController.js'

const router = express.Router()

router.get('/', getCashClosures)
router.get('/today-summary', getTodaySalesSummary)
router.get('/:date', getCashClosureByDate)
router.post('/', createCashClosure)
router.put('/:id', updateCashClosure)
router.delete('/:id', deleteCashClosure)

export default router
