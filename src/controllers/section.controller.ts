import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { AppError } from '../middlewares/error.middleware.js';
import { sectionProductInclude } from '../utils/productQuery.js';

const CACHE_PUBLIC = 'public, max-age=60, stale-while-revalidate=300';

const slugify = (text: string) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
};

const VALID_SECTION_TYPES = ['CAROUSEL', 'COLLECTIONS', 'SPLIT', 'DEPARTMENTS'] as const;

const normalizeSectionType = (type?: string | null) => {
  if (!type || type === 'GRID') return 'CAROUSEL';
  return VALID_SECTION_TYPES.includes(type as (typeof VALID_SECTION_TYPES)[number]) ? type : 'CAROUSEL';
};

const pickSectionContentFields = (body: Record<string, unknown>, sectionType?: string) => {
  const fields: Record<string, unknown> = {};
  const isSplit = sectionType === 'SPLIT';

  if (body.subtitle !== undefined) fields.subtitle = body.subtitle || null;
  if (body.description !== undefined) fields.description = body.description || null;
  if (body.linkUrl !== undefined) fields.linkUrl = body.linkUrl || null;

  if (isSplit) {
    if (body.bannerImage !== undefined) fields.bannerImage = body.bannerImage || null;
    if (body.buttonText !== undefined) fields.buttonText = body.buttonText || 'Shop Now';
    if (body.backgroundColor !== undefined) fields.backgroundColor = body.backgroundColor || '#8b1a2a';
    if (body.splitAlign !== undefined) fields.splitAlign = body.splitAlign || 'IMAGE_LEFT';
    if (body.titleRight !== undefined) fields.titleRight = body.titleRight || null;
    if (body.subtitleRight !== undefined) fields.subtitleRight = body.subtitleRight || null;
    if (body.descriptionRight !== undefined) fields.descriptionRight = body.descriptionRight || null;
    if (body.bannerImageRight !== undefined) fields.bannerImageRight = body.bannerImageRight || null;
    if (body.buttonTextRight !== undefined) fields.buttonTextRight = body.buttonTextRight || 'Shop Now';
    if (body.linkUrlRight !== undefined) fields.linkUrlRight = body.linkUrlRight || null;
    if (body.backgroundColorRight !== undefined) fields.backgroundColorRight = body.backgroundColorRight || '#9c8485';
  }

  return fields;
};

const sortProductsByOrder = (products: any[], orderedIds?: string[] | null) => {
  if (!orderedIds?.length) return products;
  const rank = new Map(orderedIds.map((id, i) => [id, i]));
  return [...products].sort((a, b) => {
    const ai = rank.get(a.id) ?? 9999;
    const bi = rank.get(b.id) ?? 9999;
    return ai - bi;
  });
};

const sectionPublicInclude = {
  products: sectionProductInclude,
};

const sectionAdminInclude = {
  products: {
    include: {
      images: { orderBy: { sortOrder: 'asc' as const } },
      category: true,
    },
  },
};

export const getSections = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sections = await prisma.homepageSection.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: sectionPublicInclude,
    });

    const normalized = sections.map((s) => ({
      ...s,
      type: normalizeSectionType(s.type),
      products: sortProductsByOrder(s.products, s.orderedProductIds),
    }));

    res.set('Cache-Control', CACHE_PUBLIC);
    res.status(200).json({
      status: 'success',
      results: normalized.length,
      data: { sections: normalized },
    });
  } catch (error) {
    next(error);
  }
};

/** Admin: all sections including inactive */
export const getAllSections = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sections = await prisma.homepageSection.findMany({
      orderBy: { sortOrder: 'asc' },
      include: sectionAdminInclude,
    });

    const normalized = sections.map((s) => ({
      ...s,
      type: normalizeSectionType(s.type),
      products: sortProductsByOrder(s.products, s.orderedProductIds),
    }));

    res.status(200).json({
      status: 'success',
      results: normalized.length,
      data: { sections: normalized },
    });
  } catch (error) {
    next(error);
  }
};

export const getSectionById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const section = await prisma.homepageSection.findUnique({
      where: { id },
      include: {
        products: true
      }
    });

    if (!section) {
      return next(new AppError('Section not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: { section }
    });
  } catch (error) {
    next(error);
  }
};

export const createSection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { title, type, isActive, sortOrder, productIds } = req.body;
    const sectionType = normalizeSectionType(type);

    if (!title) {
      return next(new AppError('Section title is required', 400));
    }

    const slug = slugify(title);
    
    // Check if slug exists
    const existing = await prisma.homepageSection.findUnique({
      where: { slug }
    });
    
    if (existing) {
      return next(new AppError('Section with this title already exists', 400));
    }

    const productConnections = Array.isArray(productIds) 
      ? productIds.map(id => ({ id })) 
      : [];

    const section = await prisma.homepageSection.create({
      data: {
        title,
        slug,
        type: sectionType,
        isActive: isActive !== undefined ? isActive : true,
        sortOrder: sortOrder ?? 0,
        orderedProductIds: Array.isArray(productIds) ? productIds : [],
        ...pickSectionContentFields(req.body, sectionType),
        products: productConnections.length
          ? { connect: productConnections }
          : undefined,
      },
      include: {
        products: true
      }
    });

    res.status(201).json({
      status: 'success',
      data: { section }
    });
  } catch (error) {
    next(error);
  }
};

export const updateSection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, type, isActive, sortOrder, productIds } = req.body;

    const existing = await prisma.homepageSection.findUnique({
      where: { id }
    });

    if (!existing) {
      return next(new AppError('Section not found', 404));
    }

    const updatedData: any = {
      ...pickSectionContentFields(req.body, type ? normalizeSectionType(type) : existing.type),
    };
    if (title) {
      updatedData.title = title;
      updatedData.slug = slugify(title);
    }
    if (type) updatedData.type = normalizeSectionType(type);
    if (isActive !== undefined) updatedData.isActive = isActive;
    if (sortOrder !== undefined) updatedData.sortOrder = sortOrder;

    if (Array.isArray(productIds)) {
      // Filter to only product IDs that actually exist in the DB
      const existingProducts = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true },
      });
      const validIds = existingProducts.map((p) => p.id);
      updatedData.orderedProductIds = validIds;
      updatedData.products = {
        set: validIds.map((pid) => ({ id: pid })),
      };
    }

    const section = await prisma.homepageSection.update({
      where: { id },
      data: updatedData,
      include: {
        products: true
      }
    });

    res.status(200).json({
      status: 'success',
      data: { section }
    });
  } catch (error) {
    next(error);
  }
};

export const deleteSection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.homepageSection.findUnique({
      where: { id }
    });

    if (!existing) {
      return next(new AppError('Section not found', 404));
    }

    await prisma.homepageSection.delete({
      where: { id }
    });

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    next(error);
  }
};
