import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { AppError } from '../middlewares/error.middleware.js';

const slugify = (text: string) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
};

export const getCollections = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const collections = await prisma.collection.findMany({
      where: { status: true },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      status: 'success',
      results: collections.length,
      data: {
        collections,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createCollection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, slug, description, bannerImage, mobileBanner, featured, status, seoTitle, seoDescription } = req.body;

    if (!name || !bannerImage) {
      return next(new AppError('Collection name and banner image are required', 400));
    }

    const collectionSlug = slug || slugify(name);

    const existing = await prisma.collection.findUnique({
      where: { slug: collectionSlug },
    });
    if (existing) {
      return next(new AppError('Collection with this slug already exists', 400));
    }

    const collection = await prisma.collection.create({
      data: {
        name,
        slug: collectionSlug,
        description,
        bannerImage,
        mobileBanner,
        featured: featured || false,
        status: status !== undefined ? status : true,
        seoTitle,
        seoDescription,
      },
    });

    res.status(201).json({
      status: 'success',
      data: {
        collection,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateCollection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, slug, description, bannerImage, mobileBanner, featured, status, seoTitle, seoDescription } = req.body;

    const existing = await prisma.collection.findUnique({
      where: { id },
    });
    if (!existing) {
      return next(new AppError('Collection not found', 404));
    }

    const updatedData: any = {};
    if (name) updatedData.name = name;
    if (slug) updatedData.slug = slug;
    if (description !== undefined) updatedData.description = description;
    if (bannerImage) updatedData.bannerImage = bannerImage;
    if (mobileBanner !== undefined) updatedData.mobileBanner = mobileBanner;
    if (featured !== undefined) updatedData.featured = featured;
    if (status !== undefined) updatedData.status = status;
    if (seoTitle !== undefined) updatedData.seoTitle = seoTitle;
    if (seoDescription !== undefined) updatedData.seoDescription = seoDescription;

    const collection = await prisma.collection.update({
      where: { id },
      data: updatedData,
    });

    res.status(200).json({
      status: 'success',
      data: {
        collection,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCollection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.collection.findUnique({
      where: { id },
    });
    if (!existing) {
      return next(new AppError('Collection not found', 404));
    }

    await prisma.collection.delete({
      where: { id },
    });

    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};
