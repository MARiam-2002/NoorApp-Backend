import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env, ErrorCodes, HttpStatus } from '../config';
import { AppError } from './errors';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export interface JwtPayload {
  userId: string;
  email: string;
}

function assertSecureSecrets(): void {
  if (
    env.JWT_SECRET.startsWith('fallback_jwt_secret') ||
    env.JWT_REFRESH_SECRET.startsWith('fallback_jwt_refresh')
  ) {
    throw new AppError(
      'Server misconfigured: JWT secrets are not set',
      HttpStatus.SERVICE_UNAVAILABLE,
      ErrorCodes.INTERNAL_SERVER_ERROR,
    );
  }
}

export function generateAccessToken(payload: JwtPayload): string {
  assertSecureSecrets();
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as any });
}

export function generateRefreshToken(payload: JwtPayload): string {
  assertSecureSecrets();
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any });
}

export function verifyAccessToken(token: string): JwtPayload {
  assertSecureSecrets();
  try {
    return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError('Token expired', HttpStatus.UNAUTHORIZED, ErrorCodes.TOKEN_EXPIRED);
    }
    throw new AppError('Invalid token', HttpStatus.UNAUTHORIZED, ErrorCodes.INVALID_TOKEN);
  }
}

export function verifyRefreshToken(token: string): JwtPayload {
  assertSecureSecrets();
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError('Token expired', HttpStatus.UNAUTHORIZED, ErrorCodes.TOKEN_EXPIRED);
    }
    throw new AppError('Invalid token', HttpStatus.UNAUTHORIZED, ErrorCodes.INVALID_TOKEN);
  }
}
