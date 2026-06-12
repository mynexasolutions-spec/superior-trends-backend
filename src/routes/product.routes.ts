import { Router } from 'express';
import {
  getProducts,
  getProductById,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/product.controller.js';
import { protect, restrictTo } from '../middlewares/auth.middleware.js';

const router = Router();

router
  .route('/')
  .get(getProducts)
  .post(protect, restrictTo('ADMIN'), createProduct);

router
  .route('/:id')
  .get(getProductById)
  .put(protect, restrictTo('ADMIN'), updateProduct)
  .delete(protect, restrictTo('ADMIN'), deleteProduct);

router.get('/slug/:slug', getProductBySlug);

export default router;
