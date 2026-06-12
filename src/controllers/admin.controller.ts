import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';

/** HomepageSection delegate may be missing if Prisma client was not regenerated */
async function countHomepageSections(): Promise<number> {
  const delegate = (prisma as { homepageSection?: { count: () => Promise<number> } }).homepageSection;
  if (delegate?.count) {
    return delegate.count();
  }
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count FROM homepage_sections
  `;
  return Number(rows[0]?.count ?? 0);
}

export const getAdminStats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const homepageSectionsPromise = countHomepageSections();

    const [
      totalProducts,
      activeProducts,
      inactiveProducts,
      totalCategories,
      rootCategories,
      homepageSections,
      stockAgg,
      totalOrders,
      paidOrders,
      revenueAgg,
      recentProducts,
      lowStockCount,
    ] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { status: true } }),
      prisma.product.count({ where: { status: false } }),
      prisma.category.count(),
      prisma.category.count({ where: { parentId: null } }),
      homepageSectionsPromise,
      prisma.product.aggregate({
        where: { status: true },
        _sum: { stock: true },
      }),
      prisma.order.count(),
      prisma.order.count({ where: { paymentStatus: 'SUCCESS' } }),
      prisma.order.aggregate({
        where: { paymentStatus: 'SUCCESS' },
        _sum: { total: true },
      }),
      prisma.product.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          sku: true,
          salePrice: true,
          mrp: true,
          stock: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.product.count({
        where: { status: true, stock: { lte: 5 } },
      }),
    ]);

    const totalStock = stockAgg._sum.stock ?? 0;
    const totalRevenue = Math.round(Number(revenueAgg._sum.total ?? 0));

    res.status(200).json({
      status: 'success',
      data: {
        stats: {
          totalProducts,
          activeProducts,
          inactiveProducts,
          totalCategories,
          rootCategories,
          homepageSections,
          totalStock,
          lowStockCount,
          totalOrders,
          paidOrders,
          totalRevenue,
        },
        recentProducts,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminProducts = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        category: true,
        collection: true,
      },
    });

    res.status(200).json({
      status: 'success',
      results: products.length,
      data: { products },
    });
  } catch (error) {
    next(error);
  }
};
