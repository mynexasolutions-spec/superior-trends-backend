import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { AppError } from '../middlewares/error.middleware.js';

export const getBanners = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const banners = await prisma.banner.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      status: 'success',
      data: { banners },
    });
  } catch (error) {
    next(error);
  }
};

export const getBannersAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const banners = await prisma.banner.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      status: 'success',
      data: { banners },
    });
  } catch (error) {
    next(error);
  }
};

export const createBanner = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { title, link, imageUrl, active } = req.body;

    if (!imageUrl) {
      return next(new AppError('Banner image URL is required', 400));
    }

    const banner = await prisma.banner.create({
      data: {
        title,
        link,
        imageUrl,
        active: active !== undefined ? Boolean(active) : true,
      },
    });

    res.status(201).json({
      status: 'success',
      data: { banner },
    });
  } catch (error) {
    next(error);
  }
};

export const updateBanner = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, link, imageUrl, active } = req.body;

    const existingBanner = await prisma.banner.findUnique({
      where: { id },
    });

    if (!existingBanner) {
      return next(new AppError('Banner not found', 404));
    }

    const updatedData: any = {};
    if (title !== undefined) updatedData.title = title;
    if (link !== undefined) updatedData.link = link;
    if (imageUrl !== undefined) updatedData.imageUrl = imageUrl;
    if (active !== undefined) updatedData.active = Boolean(active);

    const banner = await prisma.banner.update({
      where: { id },
      data: updatedData,
    });

    res.status(200).json({
      status: 'success',
      data: { banner },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteBanner = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const existingBanner = await prisma.banner.findUnique({
      where: { id },
    });

    if (!existingBanner) {
      return next(new AppError('Banner not found', 404));
    }

    await prisma.banner.delete({
      where: { id },
    });

    res.status(200).json({
      status: 'success',
      message: 'Banner deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
