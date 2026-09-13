import { PrismaClient } from '@prisma/client';

// (Removed 2026-09-13: previously hardcoded cloud URL deleted after key rotation — env only.)

// Name of the env var actually in use (or 'missing'). Exposed via
// /api/health for ops diagnosis — the VALUE is never exposed anywhere.
let matchedSource = 'missing';

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

  // No embedded fallback: fail loudly so a missing DATABASE_URL is caught at boot, not at login.
  matchedSource = 'missing';
  throw new Error('No database URL configured: set STORAGE_POSTGRES_URL / POSTGRES_URL / PRISMA_DATABASE_URL / DATABASE_URL (non-localhost).');
}

export function getDatabaseSource(): string {
  return matchedSource;
}

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  datasources: { db: { url: getDatabaseUrl() } },
});
