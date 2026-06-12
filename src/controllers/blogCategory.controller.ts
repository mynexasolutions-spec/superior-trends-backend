import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { AppError } from '../middlewares/error.middleware.js';
import { slugify } from '../utils/slugify.js';

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  let slug = slugify(base);
  let suffix = 0;
  while (true) {
    const candidate = suffix ? `${slug}-${suffix}` : slug;
    const existing = await prisma.blogCategory.findUnique({ where: { slug: candidate } });
    if (!existing || existing.id === excludeId) return candidate;
    suffix += 1;
  }
}

export const getAllBlogCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const categories = await prisma.blogCategory.findMany({
      include: {
        _count: {
          select: { posts: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.status(200).json({
      status: 'success',
      results: categories.length,
      data: { categories },
    });
  } catch (error) {
    next(error);
  }
};

export const createBlogCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, slug } = req.body;

    if (!name?.trim()) {
      return next(new AppError('Category name is required', 400));
    }

    const categorySlug = slug ? slugify(slug) : await uniqueSlug(name);

    // Verify slug unique
    const existing = await prisma.blogCategory.findUnique({
      where: { slug: categorySlug },
    });
    if (existing) {
      return next(new AppError('Category with this slug already exists', 400));
    }

    const category = await prisma.blogCategory.create({
      data: {
        name: name.trim(),
        slug: categorySlug,
      },
    });

    res.status(201).json({
      status: 'success',
      data: { category },
    });
  } catch (error) {
    next(error);
  }
};

export const updateBlogCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, slug } = req.body;

    const existing = await prisma.blogCategory.findUnique({
      where: { id },
    });
    if (!existing) {
      return next(new AppError('Category not found', 404));
    }

    const updatedData: Record<string, string> = {};

    if (name !== undefined) {
      updatedData.name = name.trim();
    }

    if (slug !== undefined) {
      updatedData.slug = slug ? await uniqueSlug(slug, id) : await uniqueSlug(name || existing.name, id);
    } else if (name !== undefined && name.trim() !== existing.name) {
      updatedData.slug = await uniqueSlug(name, id);
    }

    const category = await prisma.blogCategory.update({
      where: { id },
      data: updatedData,
    });

    res.status(200).json({
      status: 'success',
      data: { category },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteBlogCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.blogCategory.findUnique({
      where: { id },
    });
    if (!existing) {
      return next(new AppError('Category not found', 404));
    }

    await prisma.blogCategory.delete({
      where: { id },
    });

    res.status(200).json({
      status: 'success',
      message: 'Category deleted successfully',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};
