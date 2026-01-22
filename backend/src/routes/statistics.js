import express from 'express'
import {
  getDailyStats,
  getWeeklyStats,
  getMonthlyStats,
  getPaymentMethodStats,
  getSalesCountStats,
} from '../controllers/statisticsController.js'

const router = express.Router()

router.get('/daily', getDailyStats)
router.get('/weekly', getWeeklyStats)
router.get('/monthly', getMonthlyStats)
router.get('/payment-methods', getPaymentMethodStats)
router.get('/sales-count', getSalesCountStats)

export default router
