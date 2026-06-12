import { Router } from 'express';
import { upload } from '../middlewares/upload.middleware.js';
import { uploadOnCloudinary } from '../config/cloudinary.js';
import { protect, restrictTo } from '../middlewares/auth.middleware.js';
import { AppError } from '../middlewares/error.middleware.js';

const router = Router();

router.post(
  '/',
  protect,
  restrictTo('ADMIN'),
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file?.buffer?.length) {
        return next(new AppError('Please upload an image file.', 400));
      }

      const result = await uploadOnCloudinary(req.file.buffer, {
        folder: 'superior_trends',
        resource_type: 'image',
      });

      if (!result) {
        return next(new AppError('Image upload failed. Please try again.', 500));
      }

      res.status(200).json({
        status: 'success',
        data: {
          url: result.url,
          publicId: result.publicId,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
