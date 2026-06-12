import { Router } from 'express';
import {
  getAllCouponsAdmin,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  applyCoupon,
  getActiveCouponsPublic,
} from '../controllers/coupon.controller.js';
import { protect, restrictTo } from '../middlewares/auth.middleware.js';

const router = Router();

// Publicly view active coupons at checkout
router.get('/active', getActiveCouponsPublic);

// Applying coupon is available to any logged-in user
router.post('/apply', protect, applyCoupon);

// Admin-only coupon management
router.use(protect, restrictTo('ADMIN'));
router.get('/', getAllCouponsAdmin);
router.post('/', createCoupon);
router.put('/:id', updateCoupon);
router.delete('/:id', deleteCoupon);

export default router;
