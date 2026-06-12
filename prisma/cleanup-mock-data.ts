import { PrismaClient } from '@prisma/client';
import process from 'process';

const prisma = new PrismaClient();

/** Demo product SKUs from seed-products.ts */
const DEMO_SKUS = [
  'ST-WW-J001',
  'ST-WW-T001',
  'ST-WW-D001',
  'ST-WW-C001',
  'ST-AC-B001',
  'ST-AC-S001',
  'ST-AC-P001',
  'ST-AC-J001',
  'ST-EW-CS001',
  'ST-EW-BL001',
  'ST-EW-SU001',
  'ST-EW-SA001',
  'ST-EW-LC001',
];

/** Parent category slugs from reference-site demo seed */
const MOCK_PARENT_SLUGS = ['western-wear', 'ethnic-wear'];

/** Subcategory slugs under demo "Accessories" parent */
const MOCK_ACCESSORY_SUB_SLUGS = ['belts', 'scarves', 'bags-purses', 'jewellery'];

async function main() {
  console.log('🧹 Removing mock categories and demo products...');

  const deletedProducts = await prisma.product.deleteMany({
    where: { sku: { in: DEMO_SKUS } },
  });
  console.log(`✅ Deleted ${deletedProducts.count} demo products`);

  const mockParents = await prisma.category.findMany({
    where: { slug: { in: MOCK_PARENT_SLUGS } },
    select: { id: true, slug: true },
  });

  const mockAccessorySubs = await prisma.category.findMany({
    where: { slug: { in: MOCK_ACCESSORY_SUB_SLUGS } },
    select: { id: true, slug: true },
  });

  const categoryIdsToDelete = [
    ...mockParents.map((c) => c.id),
    ...mockAccessorySubs.map((c) => c.id),
  ];

  // Delete children of western-wear / ethnic-wear first
  for (const parent of mockParents) {
    const childDelete = await prisma.category.deleteMany({
      where: { parentId: parent.id },
    });
    if (childDelete.count > 0) {
      console.log(`   - Removed ${childDelete.count} subcategories under ${parent.slug}`);
    }
  }

  if (categoryIdsToDelete.length > 0) {
    // Reassign any remaining products on mock categories to null (admin can fix)
    const reassigned = await prisma.product.updateMany({
      where: { categoryId: { in: categoryIdsToDelete } },
      data: { categoryId: null },
    });
    if (reassigned.count > 0) {
      console.log(`   - Cleared category on ${reassigned.count} products (assign in Admin)`);
    }

    const deletedCats = await prisma.category.deleteMany({
      where: { id: { in: categoryIdsToDelete } },
    });
    console.log(`✅ Deleted ${deletedCats.count} mock categories`);
  }

  console.log('✅ Mock data cleanup complete. Add categories via Admin.');
}

main()
  .catch((e) => {
    console.error('❌ Cleanup failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
