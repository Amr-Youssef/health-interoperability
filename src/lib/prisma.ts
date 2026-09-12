import { PrismaClient } from '@prisma/client';

const CLOUD_DB_URL = "postgres://a94223c997cef1bf2237c8028bac295e0f65fb8f8e93e75220d68980e03961bd:sk_bxEEuQhVYitprs16P1tVj@db.prisma.io:5432/postgres?sslmode=require";

function getDatabaseUrl(): string {
  const candidates = [
    process.env.STORAGE_POSTGRES_PRISMA_URL,
    process.env.STORAGE_POSTGRES_URL,
    process.env.STORAGE_DATABASE_URL,
    process.env.STORAGE_PRISMA_DATABASE_URL,
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

  // Guaranteed fallback to the active cloud Prisma Postgres instance
  return CLOUD_DB_URL;
}

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  datasources: { db: { url: getDatabaseUrl() } },
});
