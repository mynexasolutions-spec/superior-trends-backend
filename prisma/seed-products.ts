import { PrismaClient } from '@prisma/client';
import process from 'process';

const prisma = new PrismaClient();

const slugify = (text: string) =>
  text.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/-+/g, '-');

const PRODUCTS = [
  {
    name: 'Embroidered Cotton Kurta Set',
    sku: 'ST-W-001',
    categorySlug: 'women-kurtas',
    mrp: 3499,
    salePrice: 2499,
    stock: 40,
    weight: 0.55,
    shortDescription: 'Two-piece cotton kurta with delicate thread embroidery.',
    longDescription:
      'Premium cotton kurta set with hand-finished embroidery. Includes kurta and straight pants. Machine wash cold, gentle cycle.',
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    colors: [
      { name: 'Maroon', hex: '#8b1a2a' },
      { name: 'Gold', hex: '#d4af37' },
    ],
    featured: true,
    trending: true,
  },
  {
    name: 'Floral Print Anarkali Dress',
    sku: 'ST-W-002',
    categorySlug: 'women-dresses',
    mrp: 4299,
    salePrice: 3199,
    stock: 35,
    weight: 0.48,
    shortDescription: 'Flowy anarkali with soft floral print, ideal for festivals.',
    longDescription: 'Lightweight anarkali dress with flattering silhouette. Lined bodice, flowy skirt.',
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    colors: [
      { name: 'Pink', hex: '#e75480' },
      { name: 'Navy', hex: '#1a2a4a' },
    ],
    featured: true,
    trending: false,
  },
  {
    name: 'Silk Blend Saree with Blouse',
    sku: 'ST-W-003',
    categorySlug: 'women-sarees',
    mrp: 5999,
    salePrice: 4499,
    stock: 25,
    weight: 0.62,
    shortDescription: 'Lightweight silk-blend saree with matching unstitched blouse piece.',
    longDescription: 'Elegant silk-blend saree with contrast border. Includes unstitched blouse fabric.',
    sizes: ['Free Size'],
    colors: [
      { name: 'Gold', hex: '#d4af37' },
      { name: 'Maroon', hex: '#8b1a2a' },
    ],
    featured: true,
    trending: true,
  },
  {
    name: 'Casual Linen Palazzo Set',
    sku: 'ST-W-004',
    categorySlug: 'women-cord-sets',
    mrp: 2799,
    salePrice: 1999,
    stock: 50,
    weight: 0.42,
    shortDescription: 'Breathable linen co-ord with palazzo and short kurta.',
    longDescription: 'Summer-ready linen set. Relaxed fit, natural texture, easy care.',
    sizes: ['S', 'M', 'L', 'XL'],
    colors: [
      { name: 'Cream', hex: '#f5f0e8' },
      { name: 'Olive', hex: '#556b2f' },
    ],
    featured: false,
    trending: true,
  },
  {
    name: 'Party Wear Sequin Top',
    sku: 'ST-W-005',
    categorySlug: 'women-tops',
    mrp: 1999,
    salePrice: 1299,
    stock: 60,
    weight: 0.28,
    shortDescription: 'Shimmer sequin top for evening wear; pair with skirts or trousers.',
    longDescription: 'Statement sequin top with comfortable lining. Perfect for parties and celebrations.',
    sizes: ['XS', 'S', 'M', 'L'],
    colors: [
      { name: 'Black', hex: '#1a1a1a' },
      { name: 'Gold', hex: '#d4af37' },
    ],
    featured: false,
    trending: false,
  },
  {
    name: 'Slim Fit Denim Jeans',
    sku: 'ST-M-001',
    categorySlug: 'men-jeans',
    mrp: 2499,
    salePrice: 1799,
    stock: 80,
    weight: 0.65,
    shortDescription: 'Stretch denim slim-fit jeans in classic indigo wash.',
    longDescription: 'Premium stretch denim with comfort waistband. Classic five-pocket styling.',
    sizes: ['28', '30', '32', '34', '36'],
    colors: [
      { name: 'Blue', hex: '#1a4fa0' },
      { name: 'Black', hex: '#1a1a1a' },
    ],
    featured: true,
    trending: true,
  },
  {
    name: 'Formal Cotton Shirt',
    sku: 'ST-M-002',
    categorySlug: 'men-shirts',
    mrp: 1899,
    salePrice: 1299,
    stock: 70,
    weight: 0.32,
    shortDescription: 'Wrinkle-resistant cotton shirt for office and events.',
    longDescription: 'Crisp cotton shirt with button-down collar. Ideal for formal and semi-formal wear.',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colors: [
      { name: 'White', hex: '#ffffff' },
      { name: 'Navy', hex: '#1a2a4a' },
    ],
    featured: true,
    trending: false,
  },
  {
    name: 'Kurta Pajama Set – Festive',
    sku: 'ST-M-003',
    categorySlug: 'men-kurta-sets',
    mrp: 3299,
    salePrice: 2399,
    stock: 45,
    weight: 0.58,
    shortDescription: 'Festive kurta pajama in rich jacquard weave.',
    longDescription: 'Traditional kurta pajama set for weddings and festivals. Rich fabric, elegant finish.',
    sizes: ['S', 'M', 'L', 'XL'],
    colors: [
      { name: 'Maroon', hex: '#8b1a2a' },
      { name: 'Cream', hex: '#f5f0e8' },
    ],
    featured: true,
    trending: true,
  },
  {
    name: 'Casual Polo T-Shirt',
    sku: 'ST-M-004',
    categorySlug: 'men-polo',
    mrp: 1299,
    salePrice: 899,
    stock: 90,
    weight: 0.22,
    shortDescription: 'Soft cotton polo with ribbed collar, everyday comfort.',
    longDescription: 'Breathable cotton polo for daily wear. Ribbed collar and cuffs.',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colors: [
      { name: 'Black', hex: '#1a1a1a' },
      { name: 'Olive', hex: '#556b2f' },
    ],
    featured: false,
    trending: false,
  },
  {
    name: 'Leather Crossbody Bag',
    sku: 'ST-A-001',
    categorySlug: 'bags-purses',
    mrp: 3999,
    salePrice: 2799,
    stock: 30,
    weight: 0.45,
    shortDescription: 'Genuine leather crossbody with adjustable strap and inner zip pocket.',
    longDescription: 'Handcrafted leather crossbody bag. Multiple compartments, durable hardware.',
    sizes: ['OS'],
    colors: [
      { name: 'Tan', hex: '#a0785c' },
      { name: 'Black', hex: '#1c1c1c' },
    ],
    featured: true,
    trending: true,
  },
  {
    name: 'Gold-Plated Jhumka Earrings',
    sku: 'ST-A-002',
    categorySlug: 'jewellery',
    mrp: 1499,
    salePrice: 999,
    stock: 100,
    weight: 0.05,
    shortDescription: 'Traditional jhumka earrings, gold-plated, nickel-free.',
    longDescription: 'Classic jhumka design with secure post-back. Hypoallergenic plating.',
    sizes: ['OS'],
    colors: [
      { name: 'Gold', hex: '#d4af37' },
      { name: 'Rose Gold', hex: '#b76e79' },
    ],
    featured: true,
    trending: false,
  },
  {
    name: 'Printed Silk Scarf',
    sku: 'ST-A-003',
    categorySlug: 'scarves',
    mrp: 1299,
    salePrice: 799,
    stock: 55,
    weight: 0.12,
    shortDescription: 'Lightweight silk scarf with heritage print; versatile styling.',
    longDescription: 'Soft silk scarf for neck, hair, or bag styling. Heritage-inspired print.',
    sizes: ['OS'],
    colors: [
      { name: 'Rose', hex: '#e75480' },
      { name: 'Navy', hex: '#1a2a4a' },
    ],
    featured: false,
    trending: true,
  },
];

async function main() {
  console.log('🌱 Seeding 12 products (OMR)...');

  const categories = await prisma.category.findMany();
  const catBySlug = Object.fromEntries(categories.map((c) => [c.slug, c.id]));

  const required = ['women', 'men', 'accessories'];
  for (const slug of required) {
    if (!catBySlug[slug]) {
      console.error(`❌ Missing category "${slug}". Run: npm run seed`);
      process.exit(1);
    }
  }

  let created = 0;
  let skipped = 0;

  for (const p of PRODUCTS) {
    const categoryId = catBySlug[p.categorySlug];
    const existing = await prisma.product.findUnique({ where: { sku: p.sku } });

    if (existing) {
      await prisma.product.update({
        where: { sku: p.sku },
        data: {
          slug: slugify(`${p.name}-${p.sku}`),
          name: p.name,
          shortDescription: p.shortDescription,
          longDescription: p.longDescription,
          categoryId,
          mrp: p.mrp,
          salePrice: p.salePrice,
          stock: p.stock,
          status: true,
          featured: p.featured ?? false,
          trending: p.trending ?? false,
          weight: p.weight,
          sizes: p.sizes,
          colors: p.colors,
        },
      });
      console.log(`🔄 Updated: ${p.name} — ﷼${p.salePrice}`);
      skipped++;
      continue;
    }

    const slug = slugify(`${p.name}-${p.sku}`);

    await prisma.product.create({
      data: {
        name: p.name,
        slug,
        sku: p.sku,
        shortDescription: p.shortDescription,
        longDescription: p.longDescription,
        categoryId,
        brand: 'Superior Trends',
        mrp: p.mrp,
        salePrice: p.salePrice,
        stock: p.stock,
        status: true,
        featured: p.featured ?? false,
        trending: p.trending ?? false,
        weight: p.weight,
        sizes: p.sizes,
        colors: p.colors,
      },
    });

    console.log(`✅ Created: ${p.name} — ﷼${p.salePrice}`);
    created++;
  }

  console.log(`\n🌱 Done — ${created} created, ${skipped} updated/skipped.`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
