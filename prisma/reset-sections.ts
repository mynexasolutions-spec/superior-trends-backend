import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Step 1: Disconnect ALL products from ALL sections first (clean slate)
  const sections = await prisma.homepageSection.findMany();
  console.log(`Resetting ${sections.length} sections...`);
  for (const s of sections) {
    await prisma.homepageSection.update({
      where: { id: s.id },
      data: {
        products: { set: [] },
        orderedProductIds: [],
      },
    });
    console.log(`  ✓ Cleared products from "${s.title}"`);
  }

  // Step 2: Get all current products in DB
  const allProducts = await prisma.product.findMany({ where: { status: true } });
  console.log(`\nFound ${allProducts.length} active products.`);
  if (allProducts.length === 0) {
    console.error('❌ No products found. Run npm run seed:products first.');
    await prisma.$disconnect();
    return;
  }
  const productIds = allProducts.map((p) => p.id);

  // Step 3: Assign current products to all sections
  for (const s of sections) {
    await prisma.homepageSection.update({
      where: { id: s.id },
      data: {
        products: { set: allProducts.map((p) => ({ id: p.id })) },
        orderedProductIds: productIds,
        isActive: true,
      },
    });
    console.log(`  ✅ Assigned ${allProducts.length} products to "${s.title}"`);
  }

  console.log('\n🌱 All done! Sections are synced with current products.');
  await prisma.$disconnect();
}

main().catch(console.error);
