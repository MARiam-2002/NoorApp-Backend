import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function generateRandomToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

export function hashValue(value: string, salt?: string): { hash: string; salt: string } {
  const resolvedSalt = salt ?? randomBytes(16).toString('hex');
  const hash = scryptSync(value, resolvedSalt, 64).toString('hex');

  return { hash, salt: resolvedSalt };
}

export function verifyHash(value: string, hash: string, salt: string): boolean {
  const derivedHash = scryptSync(value, salt, 64);
  const storedHash = Buffer.from(hash, 'hex');

  if (derivedHash.length !== storedHash.length) {
    return false;
  }

  return timingSafeEqual(derivedHash, storedHash);
}

export function sha256(value: string): string {
  return scryptSync(value, 'noor-static-salt', 32).toString('hex');
}
