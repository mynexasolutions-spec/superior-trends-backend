import { Router } from 'express';
import {
  getCollections,
  createCollection,
  updateCollection,
  deleteCollection,
} from '../controllers/collection.controller.js';
import { protect, restrictTo } from '../middlewares/auth.middleware.js';

const router = Router();

router
  .route('/')
  .get(getCollections)
  .post(protect, restrictTo('ADMIN'), createCollection);

router
  .route('/:id')
  .put(protect, restrictTo('ADMIN'), updateCollection)
  .delete(protect, restrictTo('ADMIN'), deleteCollection);

export default router;
