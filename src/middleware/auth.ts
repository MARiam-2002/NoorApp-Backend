import type { NextFunction, Request, Response } from 'express';
import { ErrorCodes, HttpStatus } from '../config';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { verifyAccessToken } from '../lib/auth';

function extractBearerToken(authorizationHeader: string | string[] | undefined): string | null {
  const raw = Array.isArray(authorizationHeader) ? authorizationHeader[0] : authorizationHeader;
  if (!raw) return null;
  const value = String(raw).trim();
  if (!value.toLowerCase().startsWith('bearer ')) return null;
  const token = value.slice(7).trim();
  return token.length > 0 ? token : null;
}

function userIdFromAccessPayload(payload: { userId?: string; sub?: string }): string | null {
  const id = payload.userId || payload.sub;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        sub: string;
        email: string;
        role: string;
      };
      requestId?: string;
    }
  }
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
    }
    const payload = verifyAccessToken(token) as { userId?: string; sub?: string; email?: string };
    const userId = userIdFromAccessPayload(payload);
    if (!userId) {
      throw new AppError('Invalid token', HttpStatus.UNAUTHORIZED, ErrorCodes.INVALID_TOKEN);
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(user as any).isActive) {
      throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
    }
    req.user = {
      sub: userId,
      email: payload.email || (user as any).email || '',
      role: (user as any).role || 'USER',
    };
    next();
  } catch (error) {
    next(error);
  }
}

export async function optionalAuthenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) return next();
    const payload = verifyAccessToken(token) as { userId?: string; sub?: string; email?: string };
    const userId = userIdFromAccessPayload(payload);
    if (!userId) return next();
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(user as any).isActive) return next();
    req.user = {
      sub: userId,
      email: payload.email || (user as any).email || '',
      role: (user as any).role || 'USER',
    };
    next();
  } catch {
    // Invalid/expired token → treat as anonymous (public catalog only)
    next();
  }
}
