import { Router } from 'express';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/category.controller.js';
import { protect, restrictTo } from '../middlewares/auth.middleware.js';

const router = Router();

router
  .route('/')
  .get(getCategories)
  .post(protect, restrictTo('ADMIN'), createCategory);

router
  .route('/:id')
  .put(protect, restrictTo('ADMIN'), updateCategory)
  .delete(protect, restrictTo('ADMIN'), deleteCategory);

export default router;
