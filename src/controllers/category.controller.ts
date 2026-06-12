import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { AppError } from '../middlewares/error.middleware.js';

// Helper to generate slug
const slugify = (text: string) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-'); // Replace multiple - with single -
};

export const getCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { flat } = req.query;

    if (flat === 'true') {
      const allCategories = await prisma.category.findMany({
        orderBy: { sortOrder: 'asc' },
      });
      res.status(200).json({
        status: 'success',
        results: allCategories.length,
        data: {
          categories: allCategories,
        },
      });
      return;
    }

    const categories = await prisma.category.findMany({
      where: { status: true },
      include: {
        children: {
          include: {
            children: true // Support recursive nesting if needed
          }
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    // Only return top-level categories, showing subcategories nested inside them
    const rootCategories = categories.filter((cat) => !cat.parentId);

    res.status(200).json({
      status: 'success',
      results: rootCategories.length,
      data: {
        categories: rootCategories,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, slug, parentId, image, description, sortOrder, status, seoTitle, seoDescription } = req.body;

    if (!name) {
      return next(new AppError('Category name is required', 400));
    }

    const categorySlug = slug || slugify(name);

    // Verify slug unique
    const existing = await prisma.category.findUnique({
      where: { slug: categorySlug },
    });
    if (existing) {
      return next(new AppError('Category with this slug already exists', 400));
    }

    const category = await prisma.category.create({
      data: {
        name,
        slug: categorySlug,
        parentId: parentId || null,
        image,
        description,
        sortOrder: sortOrder || 0,
        status: status !== undefined ? status : true,
        seoTitle,
        seoDescription,
      },
    });

    res.status(201).json({
      status: 'success',
      data: {
        category,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, slug, parentId, image, description, sortOrder, status, seoTitle, seoDescription } = req.body;

    const existing = await prisma.category.findUnique({
      where: { id },
    });
    if (!existing) {
      return next(new AppError('Category not found', 404));
    }

    const updatedData: any = {};
    if (name) updatedData.name = name;
    if (slug) updatedData.slug = slug;
    if (parentId !== undefined) updatedData.parentId = parentId || null;
    if (image !== undefined) updatedData.image = image;
    if (description !== undefined) updatedData.description = description;
    if (sortOrder !== undefined) updatedData.sortOrder = sortOrder;
    if (status !== undefined) updatedData.status = status;
    if (seoTitle !== undefined) updatedData.seoTitle = seoTitle;
    if (seoDescription !== undefined) updatedData.seoDescription = seoDescription;

    const category = await prisma.category.update({
      where: { id },
      data: updatedData,
    });

    res.status(200).json({
      status: 'success',
      data: {
        category,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.category.findUnique({
      where: { id },
    });
    if (!existing) {
      return next(new AppError('Category not found', 404));
    }

    await prisma.category.delete({
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
