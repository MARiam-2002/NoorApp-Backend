import { randomInt } from 'node:crypto';

export function generateOtp(length = 6): string {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return String(randomInt(min, max + 1));
}

export function generateOtpExpiry(minutes = 10): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

export function isOtpExpired(expiresAt: Date): boolean {
  return expiresAt.getTime() < Date.now();
}
