/** Lean product payload for storefront lists (faster JSON + DB) */
export const storefrontProductSelect = {
  id: true,
  name: true,
  slug: true,
  sku: true,
  shortDescription: true,
  mrp: true,
  salePrice: true,
  stock: true,
  status: true,
  featured: true,
  trending: true,
  sizes: true,
  colors: true,
  brand: true,
  weight: true,
  categoryId: true,
  collectionId: true,
  createdAt: true,
  category: {
    select: { id: true, name: true, slug: true, parentId: true },
  },
  collection: {
    select: { id: true, name: true, slug: true },
  },
  images: {
    take: 1,
    orderBy: { sortOrder: 'asc' as const },
    select: { imageUrl: true, sortOrder: true, isMain: true },
  },
  // Approved reviews aggregate for rating chip
  reviews: {
    where: { status: 'APPROVED' },
    select: { rating: true },
  },
} as const;

export const adminProductInclude = {
  images: { orderBy: { sortOrder: 'asc' as const } },
  category: true,
  collection: true,
};

export const sectionProductInclude = {
  where: { status: true },
  select: storefrontProductSelect,
};

export const STOREFRONT_PRODUCT_LIMIT = 200;
export const ADMIN_PRODUCT_LIMIT = 500;

export function resolveProductTake(isAdminList: boolean, limitParam: unknown): number {
  const requested = Number(limitParam);
  const cap = isAdminList ? ADMIN_PRODUCT_LIMIT : STOREFRONT_PRODUCT_LIMIT;
  if (!limitParam || Number.isNaN(requested)) {
    return isAdminList ? ADMIN_PRODUCT_LIMIT : STOREFRONT_PRODUCT_LIMIT;
  }
  return Math.min(Math.max(requested, 1), cap);
}
