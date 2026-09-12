import { PrismaClient } from '@prisma/client';

function getDatabaseUrl(): string {
  // Check all possible Vercel / Neon / Supabase environment variable names
  const candidates = [
    process.env.STORAGE_POSTGRES_PRISMA_URL,
    process.env.STORAGE_POSTGRES_URL,
    process.env.STORAGE_DATABASE_URL,
    process.env.STORAGE_PRISMA_URL,
    process.env.STORAGE_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL,
    process.env.PRISMA_DATABASE_URL,
    process.env.DATABASE_URL,
  ];

  for (const name of candidates) {
    const val = process.env[name];
    if (val && !val.includes('localhost')) {
      return val;
    }
  }

  // If in local dev or no remote URL found, fallback to DATABASE_URL
  return process.env.DATABASE_URL || '';
}

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  datasources: { db: { url: getDatabaseUrl() } },
});
