import { Router } from 'express';
import {
  getBanners,
  getBannersAdmin,
  createBanner,
  updateBanner,
  deleteBanner,
} from '../controllers/banner.controller.js';
import { protect, restrictTo } from '../middlewares/auth.middleware.js';

const router = Router();

// Public route to get active banners
router.get('/', getBanners);

// Protected routes (Admin only)
router.use(protect, restrictTo('ADMIN'));

router.get('/admin', getBannersAdmin);
router.post('/', createBanner);
router.put('/:id', updateBanner);
router.delete('/:id', deleteBanner);

export default router;
