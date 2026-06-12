import { Router } from 'express';
import {
  submitContact,
  getContactMessages,
  updateContactStatus,
  deleteContactMessage,
} from '../controllers/contact.controller.js';
import { protect, restrictTo } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/', submitContact);

router.use(protect, restrictTo('ADMIN'));
router.get('/admin', getContactMessages);
router.patch('/:id/status', updateContactStatus);
router.delete('/:id', deleteContactMessage);

export default router;
