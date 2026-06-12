import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Removing all demo products...');

  // 1. Disconnect all products from all sections first
  const sections = await prisma.homepageSection.findMany();
  for (const s of sections) {
    await prisma.homepageSection.update({
      where: { id: s.id },
      data: { products: { set: [] }, orderedProductIds: [] },
    });
  }
  console.log(`✓ Cleared products from ${sections.length} sections`);

  // 2. Delete all products (cascades to images, cart items, wishlist, reviews, order items)
  const deleted = await prisma.product.deleteMany({});
  console.log(`✓ Deleted ${deleted.count} products`);

  console.log('\n✅ Shop is now empty. Add products from the admin panel.');
  await prisma.$disconnect();
}

main().catch(console.error);
