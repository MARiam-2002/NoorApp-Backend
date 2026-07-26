import type { NextFunction, Request, Response } from 'express';
import { ErrorCodes, HttpStatus } from '../config';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { verifyAccessToken } from '../lib/auth';

function extractBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader?.startsWith('Bearer ')) return null;
  const token = authorizationHeader.slice(7).trim();
  return token.length > 0 ? token : null;
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
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !(user as any).isActive) {
      throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
    }
    req.user = {
      sub: payload.userId,
      email: payload.email,
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
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !(user as any).isActive) return next();
    req.user = {
      sub: payload.userId,
      email: payload.email,
      role: (user as any).role || 'USER',
    };
    next();
  } catch {
    next();
  }
}
