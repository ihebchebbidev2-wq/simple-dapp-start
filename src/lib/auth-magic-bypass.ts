import type { User } from '@/lib/api';

/**
 * Client-only “magic” admin session (no server JWT).
 * Anyone can read these strings in the shipped bundle — use only if you accept that risk.
 * Protected API routes still need a real backend user + token unless you add server support.
 */
export const MAGIC_ADMIN_EMAIL = 'admin@remquip.com';
export const MAGIC_ADMIN_PASSWORD = 'Remquip2026';

const MAGIC_TOKEN_PREFIX = 'remquip_magic_v1:';

export const MAGIC_USER_STORAGE_KEY = 'remquip_magic_user';

export function isMagicCredentials(email: string, password: string): boolean {
  return (
    email.trim().toLowerCase() === MAGIC_ADMIN_EMAIL.toLowerCase() &&
    password === MAGIC_ADMIN_PASSWORD
  );
}

export function isMagicToken(token: string | null | undefined): boolean {
  return typeof token === 'string' && token.startsWith(MAGIC_TOKEN_PREFIX);
}

export function createMagicSessionUser(): User {
  const now = new Date().toISOString();
  return {
    id: '00000000-0000-4000-8000-00000000magic',
    email: MAGIC_ADMIN_EMAIL,
    full_name: 'REMQUIP Administrator',
    role: 'admin',
    status: 'active',
    phone: '',
    created_at: now,
    updated_at: now,
  };
}

export function makeMagicToken(): string {
  return `${MAGIC_TOKEN_PREFIX}${crypto.randomUUID()}`;
}
