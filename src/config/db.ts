import { PrismaClient } from '@prisma/client';
import logger from './logger.js';

export const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'stdout', level: 'info' },
    { emit: 'stdout', level: 'warn' },
    { emit: 'stdout', level: 'error' },
  ],
});

// Log prisma queries through winston logger
(prisma as any).$on('query', (e: any) => {
  logger.info(`Prisma SQL: ${e.query} | Params: ${e.params} | Duration: ${e.duration}ms`);
});

export const connectDB = async (): Promise<void> => {
  try {
    await prisma.$connect();
    logger.info('📡 PostgreSQL Connected successfully via Prisma.');
  } catch (error) {
    logger.error('❌ PostgreSQL database connection error:', error);
    process.exit(1);
  }
};
