import { Router } from 'express';
import {
  getSections,
  getAllSections,
  getSectionById,
  createSection,
  updateSection,
  deleteSection,
} from '../controllers/section.controller.js';
import { protect, restrictTo } from '../middlewares/auth.middleware.js';

const router = Router();

// Public route
router.get('/', getSections);

// Admin only routes
router.use(protect);
router.use(restrictTo('ADMIN'));

router.get('/manage/all', getAllSections);
router.post('/', createSection);
router.patch('/:id', updateSection);
router.delete('/:id', deleteSection);

router.get('/:id', getSectionById);

export default router;
