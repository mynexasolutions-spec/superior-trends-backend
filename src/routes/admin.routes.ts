import { Router } from 'express';
import { getAdminStats, getAdminProducts } from '../controllers/admin.controller.js';
import { protect, restrictTo } from '../middlewares/auth.middleware.js';

const router = Router();

/** Public read-only aggregates for admin dashboard */
router.get('/stats', getAdminStats);

router.get('/products', protect, restrictTo('ADMIN'), getAdminProducts);

export default router;
