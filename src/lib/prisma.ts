import { PrismaClient } from '@prisma/client';

const CLOUD_DB_URL = "postgres://a94223c997cef1bf2237c8028bac295e0f65fb8f8e93e75220d68980e03961bd:sk_bxEEuQhVYitprs16P1tVj@db.prisma.io:5432/postgres?sslmode=require";

// Name of the env var actually in use (or 'embedded-fallback'). Exposed via
// /api/health for ops diagnosis — the VALUE is never exposed anywhere.
let matchedSource = 'embedded-fallback';

function getDatabaseUrl(): string {
  const names = [
    'STORAGE_POSTGRES_PRISMA_URL',
    'STORAGE_POSTGRES_URL',
    'STORAGE_DATABASE_URL',
    'STORAGE_PRISMA_DATABASE_URL',
    'STORAGE_PRISMA_URL',
    'STORAGE_URL',
    'POSTGRES_PRISMA_URL',
    'POSTGRES_URL',
    'PRISMA_DATABASE_URL',
    'DATABASE_URL',
  ];

  for (const name of names) {
    const val = process.env[name];
    if (val && !val.includes('localhost')) {
      matchedSource = 'env:' + name;
      return val;
    }
  }

  // Guaranteed fallback to the active cloud Prisma Postgres instance
  matchedSource = 'embedded-fallback';
  return CLOUD_DB_URL;
}

export function getDatabaseSource(): string {
  return matchedSource;
}

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  datasources: { db: { url: getDatabaseUrl() } },
});
