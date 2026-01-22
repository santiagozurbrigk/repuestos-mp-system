import express from 'express'
import {
  getCashClosures,
  getCashClosureByDate,
  createCashClosure,
  getTodaySalesSummary,
  deleteCashClosure,
} from '../controllers/cashClosureController.js'

const router = express.Router()

router.get('/', getCashClosures)
router.get('/today-summary', getTodaySalesSummary)
router.get('/:date', getCashClosureByDate)
router.post('/', createCashClosure)
router.delete('/:id', deleteCashClosure)

export default router
