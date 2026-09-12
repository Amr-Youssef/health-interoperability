import { PrismaClient } from '@prisma/client';

const dbUrl =
  process.env.STORAGE_URL ||
  process.env.STORAGE_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL;

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  datasources: { db: { url: dbUrl } },
});
