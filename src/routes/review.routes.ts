import { Router } from 'express';
import {
  createReview,
  getProductReviews,
  getMyReviewStatus,
  updateReviewStatus,
  getAllReviews,
  deleteReview,
} from '../controllers/review.controller.js';
import { protect, restrictTo } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/product/:productId', getProductReviews);
router.get('/my-status/:productId', protect, getMyReviewStatus);
router.post('/', protect, createReview);
router.get('/', protect, restrictTo('ADMIN'), getAllReviews);
router.put('/:id/status', protect, restrictTo('ADMIN'), updateReviewStatus);
router.delete('/:id', protect, restrictTo('ADMIN'), deleteReview);

export default router;
