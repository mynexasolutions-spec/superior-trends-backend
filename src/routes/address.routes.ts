import { Router } from 'express';
import {
  getMyAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
} from '../controllers/address.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(protect);

router
  .route('/')
  .get(getMyAddresses)
  .post(createAddress);

router
  .route('/:id')
  .put(updateAddress)
  .delete(deleteAddress);

export default router;
