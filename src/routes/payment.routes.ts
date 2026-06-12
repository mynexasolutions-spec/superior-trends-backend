import { Router } from 'express';
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
} from '../controllers/payment.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(protect);

router.post('/create-order', createRazorpayOrder);
router.post('/verify', verifyRazorpayPayment);

export default router;
