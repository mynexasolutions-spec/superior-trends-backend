import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { AppError } from '../middlewares/error.middleware.js';
import { slugify } from '../utils/slugify.js';

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  let slug = slugify(base);
  let suffix = 0;
  while (true) {
    const candidate = suffix ? `${slug}-${suffix}` : slug;
    const existing = await prisma.blogPost.findUnique({ where: { slug: candidate } });
    if (!existing || existing.id === excludeId) return candidate;
    suffix += 1;
  }
}

export const getPublishedBlogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { category } = req.query;
    const whereClause: Record<string, any> = { isPublished: true };

    if (category) {
      whereClause.category = { slug: String(category) };
    }

    const posts = await prisma.blogPost.findMany({
      where: whereClause,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        coverImage: true,
        tag: true,
        categoryId: true,
        category: {
          select: { id: true, name: true, slug: true }
        },
        readMinutes: true,
        publishedAt: true,
        createdAt: true,
      },
    });

    res.status(200).json({
      status: 'success',
      results: posts.length,
      data: { posts },
    });
  } catch (error) {
    next(error);
  }
};

export const getBlogBySlug = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { slug } = req.params;

    const post = await prisma.blogPost.findFirst({
      where: { slug, isPublished: true },
      include: {
        category: {
          select: { id: true, name: true, slug: true }
        }
      }
    });

    if (!post) {
      return next(new AppError('Blog post not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: { post },
    });
  } catch (error) {
    next(error);
  }
};

export const getAllBlogsAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const posts = await prisma.blogPost.findMany({
      include: {
        category: {
          select: { id: true, name: true, slug: true }
        }
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.status(200).json({
      status: 'success',
      results: posts.length,
      data: { posts },
    });
  } catch (error) {
    next(error);
  }
};

export const createBlog = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      title,
      slug,
      excerpt,
      content,
      coverImage,
      tag,
      categoryId,
      readMinutes,
      isPublished,
    } = req.body;

    if (!title?.trim() || !excerpt?.trim() || !content?.trim()) {
      return next(new AppError('Title, excerpt, and content are required', 400));
    }

    const blogSlug = slug ? slugify(slug) : await uniqueSlug(title);
    const published = Boolean(isPublished);

    const post = await prisma.blogPost.create({
      data: {
        title: title.trim(),
        slug: blogSlug,
        excerpt: excerpt.trim(),
        content: content.trim(),
        coverImage: coverImage?.trim() || null,
        tag: tag?.trim() || 'Editorial',
        categoryId: categoryId || null,
        readMinutes: Number(readMinutes) || 5,
        isPublished: published,
        publishedAt: published ? new Date() : null,
      },
      include: {
        category: {
          select: { id: true, name: true, slug: true }
        }
      }
    });

    res.status(201).json({
      status: 'success',
      data: { post },
    });
  } catch (error) {
    next(error);
  }
};

export const updateBlog = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const existing = await prisma.blogPost.findUnique({ where: { id } });
    if (!existing) {
      return next(new AppError('Blog post not found', 404));
    }

    const {
      title,
      slug,
      excerpt,
      content,
      coverImage,
      tag,
      categoryId,
      readMinutes,
      isPublished,
    } = req.body;

    const data: Record<string, unknown> = {};

    if (title !== undefined) data.title = String(title).trim();
    if (excerpt !== undefined) data.excerpt = String(excerpt).trim();
    if (content !== undefined) data.content = String(content).trim();
    if (coverImage !== undefined) data.coverImage = coverImage?.trim() || null;
    if (tag !== undefined) data.tag = tag?.trim() || 'Editorial';
    if (categoryId !== undefined) data.categoryId = categoryId || null;
    if (readMinutes !== undefined) data.readMinutes = Number(readMinutes) || 5;

    if (slug !== undefined) {
      data.slug = slug ? await uniqueSlug(slug, id) : await uniqueSlug(title || existing.title, id);
    } else if (title !== undefined && title !== existing.title) {
      data.slug = await uniqueSlug(title, id);
    }

    if (isPublished !== undefined) {
      const published = Boolean(isPublished);
      data.isPublished = published;
      if (published && !existing.publishedAt) {
        data.publishedAt = new Date();
      }
      if (!published) {
        data.publishedAt = null;
      }
    }

    const post = await prisma.blogPost.update({
      where: { id },
      data,
      include: {
        category: {
          select: { id: true, name: true, slug: true }
        }
      }
    });

    res.status(200).json({
      status: 'success',
      data: { post },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteBlog = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.blogPost.delete({ where: { id } });

    res.status(200).json({
      status: 'success',
      message: 'Blog post deleted',
    });
  } catch (error) {
    next(error);
  }
};
