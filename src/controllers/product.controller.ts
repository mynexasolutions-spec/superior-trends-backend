import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { AppError } from '../middlewares/error.middleware.js';
import {
  adminProductInclude,
  resolveProductTake,
  storefrontProductSelect,
} from '../utils/productQuery.js';

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

export const getProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { category, collection, priceMin, priceMax, search, featured, trending, sortBy, page = 1, limit, admin } = req.query;
    const isAdminList = admin === 'true';

    const take = resolveProductTake(isAdminList, limit);
    const skip = (Number(page) - 1) * take;

    const where: any = {};
    if (!isAdminList) {
      where.status = true;
    }

    // Apply category filters (parent slug includes all subcategories)
    if (category) {
      const categorySlug = String(category);
      const cat = await prisma.category.findUnique({
        where: { slug: categorySlug },
        include: { children: { select: { id: true } } },
      });
      if (cat?.children?.length) {
        where.categoryId = { in: [cat.id, ...cat.children.map((c) => c.id)] };
      } else if (cat) {
        where.categoryId = cat.id;
      } else {
        where.category = { slug: categorySlug };
      }
    }

    // Apply collection filters
    if (collection) {
      where.collection = { slug: String(collection) };
    }

    // Apply section filters
    if (req.query.section) {
      where.sections = { some: { slug: String(req.query.section) } };
    }

    // Apply price range filters
    if (priceMin || priceMax) {
      where.salePrice = {};
      if (priceMin) where.salePrice.gte = Number(priceMin);
      if (priceMax) where.salePrice.lte = Number(priceMax);
    }

    // Apply search filters
    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { shortDescription: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    // Apply featured / trending filters
    if (featured !== undefined) {
      where.featured = featured === 'true';
    }
    if (trending !== undefined) {
      where.trending = trending === 'true';
    }

    // Apply sorting
    let orderBy: any = { createdAt: 'desc' };
    if (sortBy) {
      if (sortBy === 'price-asc') orderBy = { salePrice: 'asc' };
      else if (sortBy === 'price-desc') orderBy = { salePrice: 'desc' };
      else if (sortBy === 'rating') orderBy = { featured: 'desc' };
    }

    const listQuery = {
      where,
      orderBy,
      skip,
      take,
    };

    const [products, totalCount] = await prisma.$transaction([
      isAdminList
        ? prisma.product.findMany({ ...listQuery, include: adminProductInclude })
        : prisma.product.findMany({ ...listQuery, select: storefrontProductSelect }),
      prisma.product.count({ where }),
    ]);

    res.set('Cache-Control', CACHE_PUBLIC);
    res.status(200).json({
      status: 'success',
      results: products.length,
      pagination: {
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / take),
        currentPage: Number(page),
        limit: take,
      },
      data: {
        products,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getProductById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        images: {
          orderBy: { sortOrder: 'asc' },
        },
        category: true,
        collection: true,
      },
    });

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        product,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getProductBySlug = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { slug } = req.params;

    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        images: {
          orderBy: { sortOrder: 'asc' },
        },
        variants: true,
        category: true,
        collection: true,
        reviews: {
          where: { status: 'APPROVED' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        product,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      name,
      slug,
      sku,
      type,
      shortDescription,
      longDescription,
      categoryId,
      collectionId,
      brand,
      mrp,
      salePrice,
      stock,
      status,
      featured,
      trending,
      weight,
      dimensions,
      seoTitle,
      seoDescription,
      images, // Array of { imageUrl, isMain, sortOrder }
      sizes,
      colors,
    } = req.body;

    if (!name || !sku || !mrp) {
      return next(new AppError('Product name, SKU and MRP are required fields', 400));
    }

    const productSlug = slug || slugify(name);

    // Verify unique SKU & Slug
    const existingSku = await prisma.product.findUnique({ where: { sku } });
    if (existingSku) {
      return next(new AppError('Product SKU already exists', 400));
    }

    const existingSlug = await prisma.product.findUnique({ where: { slug: productSlug } });
    if (existingSlug) {
      return next(new AppError('Product slug already exists', 400));
    }

    // Set default salePrice same as mrp if not supplied
    const finalSalePrice = salePrice !== undefined ? salePrice : mrp;

    const product = await prisma.product.create({
      data: {
        name,
        slug: productSlug,
        sku,
        type: type || 'SIMPLE',
        shortDescription,
        longDescription,
        categoryId: categoryId || null,
        collectionId: collectionId || null,
        brand: brand || 'Superior Trends',
        mrp,
        salePrice: finalSalePrice,
        stock: stock || 0,
        status: status !== undefined ? status : true,
        featured: featured || false,
        trending: trending || false,
        weight,
        dimensions,
        seoTitle,
        seoDescription,
        sizes: sizes || [],
        colors: colors || null,
        images: (() => {
          if (!Array.isArray(images) || images.length === 0) return undefined;
          const normalized = images
            .map((img: { imageUrl?: string; url?: string; isMain?: boolean; sortOrder?: number }, i: number) => {
              const imageUrl = String(img?.imageUrl ?? img?.url ?? '').trim();
              if (!imageUrl) return null;
              return {
                imageUrl,
                isMain: img.isMain ?? i === 0,
                sortOrder: img.sortOrder ?? i,
              };
            })
            .filter((img): img is { imageUrl: string; isMain: boolean; sortOrder: number } => img !== null);
          return normalized.length > 0 ? { create: normalized } : undefined;
        })(),
      },
      include: {
        images: true,
      },
    });

    res.status(201).json({
      status: 'success',
      data: {
        product,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      name,
      slug,
      sku,
      type,
      shortDescription,
      longDescription,
      categoryId,
      collectionId,
      brand,
      mrp,
      salePrice,
      stock,
      status,
      featured,
      trending,
      weight,
      dimensions,
      seoTitle,
      seoDescription,
      images,
      sizes,
      colors,
    } = req.body;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return next(new AppError('Product not found', 404));
    }

    const updatedData: any = {};
    if (name) updatedData.name = name;
    if (slug) updatedData.slug = slug;
    if (sku) updatedData.sku = sku;
    if (type) updatedData.type = type;
    if (shortDescription !== undefined) updatedData.shortDescription = shortDescription;
    if (longDescription !== undefined) updatedData.longDescription = longDescription;
    if (categoryId !== undefined) updatedData.categoryId = categoryId || null;
    if (collectionId !== undefined) updatedData.collectionId = collectionId || null;
    if (brand) updatedData.brand = brand;
    if (mrp !== undefined) updatedData.mrp = mrp;
    if (salePrice !== undefined) updatedData.salePrice = salePrice;
    if (stock !== undefined) updatedData.stock = stock;
    if (status !== undefined) updatedData.status = status;
    if (featured !== undefined) updatedData.featured = featured;
    if (trending !== undefined) updatedData.trending = trending;
    if (weight !== undefined) updatedData.weight = weight;
    if (dimensions !== undefined) updatedData.dimensions = dimensions;
    if (seoTitle !== undefined) updatedData.seoTitle = seoTitle;
    if (seoDescription !== undefined) updatedData.seoDescription = seoDescription;
    if (sizes !== undefined) updatedData.sizes = sizes;
    if (colors !== undefined) updatedData.colors = colors;

    if (images !== undefined) {
      const normalized = Array.isArray(images)
        ? images
            .map((img: { imageUrl?: string; url?: string; isMain?: boolean; sortOrder?: number }, i: number) => {
              const imageUrl = String(img?.imageUrl ?? img?.url ?? '').trim();
              if (!imageUrl) return null;
              return {
                imageUrl,
                isMain: img.isMain ?? i === 0,
                sortOrder: img.sortOrder ?? i,
              };
            })
            .filter(Boolean)
        : [];

      updatedData.images = {
        deleteMany: {},
        ...(normalized.length > 0 ? { create: normalized } : {}),
      };
    }

    const product = await prisma.product.update({
      where: { id },
      data: updatedData,
      include: {
        images: true,
      },
    });

    res.status(200).json({
      status: 'success',
      data: {
        product,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return next(new AppError('Product not found', 404));
    }

    await prisma.product.delete({ where: { id } });

    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};
