import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { AppError } from '../middlewares/error.middleware.js';

export const getMyWishlist = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const wishlist = await prisma.wishlist.findMany({
      where: { userId },
      include: {
        product: {
          include: {
            images: {
              where: { isMain: true },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      status: 'success',
      results: wishlist.length,
      data: {
        wishlist,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const addToWishlist = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { productId } = req.body;

    if (!productId) {
      return next(new AppError('Product ID is required', 400));
    }

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    // Verify not already in wishlist
    const existing = await prisma.wishlist.findFirst({
      where: { userId, productId },
    });

    if (existing) {
      res.status(200).json({
        status: 'success',
        message: 'Product already in wishlist',
        data: { wishlist: existing },
      });
      return;
    }

    const wishlist = await prisma.wishlist.create({
      data: {
        userId,
        productId,
      },
    });

    res.status(201).json({
      status: 'success',
      data: {
        wishlist,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const removeFromWishlist = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { productId } = req.params;

    if (!productId) {
      return next(new AppError('Product ID is required', 400));
    }

    const existing = await prisma.wishlist.findFirst({
      where: { userId, productId },
    });

    if (!existing) {
      return next(new AppError('Item not found in your wishlist', 404));
    }

    await prisma.wishlist.delete({
      where: { id: existing.id },
    });

    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};
