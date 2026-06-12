import { Router } from 'express';
import {
  getPublishedBlogs,
  getBlogBySlug,
  getAllBlogsAdmin,
  createBlog,
  updateBlog,
  deleteBlog,
} from '../controllers/blog.controller.js';
import {
  getAllBlogCategories,
  createBlogCategory,
  updateBlogCategory,
  deleteBlogCategory,
} from '../controllers/blogCategory.controller.js';
import { protect, restrictTo } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', getPublishedBlogs);
router.get('/slug/:slug', getBlogBySlug);
router.get('/categories', getAllBlogCategories);

router.use(protect, restrictTo('ADMIN'));
router.get('/manage/all', getAllBlogsAdmin);
router.post('/', createBlog);
router.put('/:id', updateBlog);
router.delete('/:id', deleteBlog);

// Blog category admin routes
router.post('/categories', createBlogCategory);
router.put('/categories/:id', updateBlogCategory);
router.delete('/categories/:id', deleteBlogCategory);

export default router;
