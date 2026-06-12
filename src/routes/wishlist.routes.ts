import { Router } from 'express';
import {
  getMyWishlist,
  addToWishlist,
  removeFromWishlist,
} from '../controllers/wishlist.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(protect);

router
  .route('/')
  .get(getMyWishlist)
  .post(addToWishlist);

router.delete('/:productId', removeFromWishlist);

export default router;
