export function getJwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET missing or too weak (min 32 chars) - configure .env');
  console.warn('[SECURITY] JWT_SECRET not set or weak - using dev fallback. Set JWT_SECRET in .env for production');
  return s && s.length >= 8 ? s : 'dev-only-super-secret-national-health-key-2026-not-for-prod';
}

export const JWT_SECRET = getJwtSecret();
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
