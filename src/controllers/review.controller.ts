import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { AppError } from '../middlewares/error.middleware.js';

export const createReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { productId, rating, title, review, images } = req.body;

    if (!productId || rating === undefined) {
      return next(new AppError('Product ID and Rating are required', 400));
    }

    if (rating < 1 || rating > 5) {
      return next(new AppError('Rating must be between 1 and 5', 400));
    }

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    // Verify user has ordered this product (verified purchase is required)
    const verifiedOrder = await prisma.order.findFirst({
      where: {
        userId,
        orderStatus: 'DELIVERED',
        items: {
          some: { productId },
        },
      },
    });

    if (!verifiedOrder) {
      return next(new AppError('You can only review products you have purchased and had delivered.', 403));
    }

    // Prevent duplicate reviews — one review per user per product
    const existingReview = await prisma.review.findFirst({
      where: { userId, productId },
    });
    if (existingReview) {
      return next(new AppError('You have already submitted a review for this product.', 409));
    }

    const isVerified = true;

    const reviewRecord = await prisma.review.create({
      data: {
        productId,
        userId,
        rating: Number(rating),
        title,
        review,
        images: images ? (images as any) : null,
        status: 'PENDING', // Require moderation by default
      },
    });

    res.status(201).json({
      status: 'success',
      data: {
        review: {
          ...reviewRecord,
          isVerified,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /reviews/my-status/:productId
 * Returns whether the authenticated user:
 *  - has already reviewed this product (and its current status)
 *  - is eligible to review it (has a DELIVERED order containing this product)
 */
export const getMyReviewStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { productId } = req.params;

    // Check eligibility: delivered order
    const verifiedOrder = await prisma.order.findFirst({
      where: {
        userId,
        orderStatus: 'DELIVERED',
        items: { some: { productId } },
      },
      select: { id: true },
    });

    // Check existing review
    const existingReview = await prisma.review.findFirst({
      where: { userId, productId },
      select: {
        id: true,
        rating: true,
        title: true,
        review: true,
        status: true,
        createdAt: true,
      },
    });

    res.status(200).json({
      status: 'success',
      data: {
        isEligible: !!verifiedOrder,
        hasReviewed: !!existingReview,
        existingReview: existingReview ?? null,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getProductReviews = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { productId } = req.params;

    const reviews = await prisma.review.findMany({
      where: { productId, status: 'APPROVED' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=300');
    res.status(200).json({
      status: 'success',
      results: reviews.length,
      data: {
        reviews,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateReviewStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body; // APPROVED or REJECTED

    if (!status || !['APPROVED', 'REJECTED', 'PENDING'].includes(status)) {
      return next(new AppError('Invalid status value', 400));
    }

    const review = await prisma.review.update({
      where: { id },
      data: { status },
    });

    res.status(200).json({
      status: 'success',
      data: {
        review,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAllReviews = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const reviews = await prisma.review.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      status: 'success',
      results: reviews.length,
      data: {
        reviews,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const exists = await prisma.review.findUnique({ where: { id } });
    if (!exists) {
      return next(new AppError('Review not found', 404));
    }

    await prisma.review.delete({
      where: { id },
    });

    res.status(200).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

