import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Get all active products
  const allProducts = await prisma.product.findMany({ where: { status: true } });
  if (allProducts.length === 0) {
    console.error('❌ No products found! Run npm run seed:products first.');
    return;
  }
  console.log(`Found ${allProducts.length} products.`);

  // Get all sections
  const sections = await prisma.homepageSection.findMany();
  console.log(`Found ${sections.length} sections.`);

  // Assign ALL products to every section (you can fine-tune later from the admin panel)
  const productIds = allProducts.map((p) => p.id);

  for (const section of sections) {
    await prisma.homepageSection.update({
      where: { id: section.id },
      data: {
        products: { set: allProducts.map((p) => ({ id: p.id })) },
        orderedProductIds: productIds,
        isActive: true,
      },
    });
    console.log(`✅ Assigned ${allProducts.length} products to section: "${section.title}"`);
  }

  console.log('\n🌱 Done! All sections now have products assigned.');
  await prisma.$disconnect();
}

main().catch(console.error);
