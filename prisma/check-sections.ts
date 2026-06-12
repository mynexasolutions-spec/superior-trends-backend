import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const sections = await prisma.homepageSection.findMany({
    include: { products: true },
    orderBy: { sortOrder: 'asc' },
  });
  console.log('Total sections:', sections.length);
  for (const s of sections) {
    console.log(`  [${s.id}] "${s.title}" | isActive=${s.isActive} | type=${s.type} | products=${s.products.length}`);
  }
  await prisma.$disconnect();
}
main().catch(console.error);
