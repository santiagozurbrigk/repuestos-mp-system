import express from 'express'
import {
  createOrderList,
  getOrderLists,
  getOrderListById,
  updateOrderList,
  deleteOrderList,
  addItemToOrderList,
  deleteItemFromOrderList,
} from '../controllers/orderListController.js'

const router = express.Router()

router.post('/', createOrderList)
router.get('/', getOrderLists)
router.get('/:id', getOrderListById)
router.put('/:id', updateOrderList)
router.delete('/:id', deleteOrderList)
router.post('/:id/items', addItemToOrderList)
router.delete('/:id/items/:itemId', deleteItemFromOrderList)

export default router
