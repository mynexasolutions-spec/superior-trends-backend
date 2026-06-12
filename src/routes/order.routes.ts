import { Router } from 'express';
import {
  createOrder,
  createCheckoutOrder,
  getMyOrders,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrderCustomer,
} from '../controllers/order.controller.js';
import { protect, restrictTo } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(protect);

router.post('/checkout', createCheckoutOrder);
router.post('/', createOrder);
router.get('/my', getMyOrders);
router.get('/admin/all', restrictTo('ADMIN'), getAllOrders);
router.post('/:id/cancel', cancelOrderCustomer);
router.get('/:id', getOrderById);
router.patch('/:id/status', restrictTo('ADMIN'), updateOrderStatus);

export default router;

