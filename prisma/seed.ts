import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import process from 'process';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  const adminEmail = 'admin@superiortrends.com';
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'Admin Superior',
        password: hashedPassword,
        role: 'ADMIN',
        phone: '+1 555-0199',
      },
    });
    console.log('✅ Admin user created:', admin.email);
  } else {
    console.log('ℹ️ Admin user already exists:', existingAdmin.email);
  }

  console.log('ℹ️ Categories are not seeded — create them in Admin → Categories.');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
