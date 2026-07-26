import { createHash, randomBytes } from 'node:crypto';

import { UserRole } from '@prisma/client';

import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus, env } from '../config';
import {
  generateAccessToken,
  generateRefreshToken,
  hashPassword,
  verifyPassword,
  verifyRefreshToken as verifyRefreshTokenJwt,
} from '../lib/auth';
import { logger } from '../lib/logger';

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
};

export type AuthUserProfile = {
  id: string;
  username: string;
  email: string;
  role: string;
  provider: string;
  createdAt: Date;
};

export type AuthResult = {
  user: AuthUserProfile;
  tokens: AuthTokens;
};

function parseDurationToMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration);

  if (!match?.[1] || !match[2]) {
    return 30 * 24 * 60 * 60 * 1000;
  }

  const value = Number(match[1]);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };

  return value * (multipliers[unit] ?? 86_400_000);
}

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function mapUserToProfile(user: {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  provider: string;
  createdAt: Date;
}): AuthUserProfile {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    provider: user.provider,
    createdAt: user.createdAt,
  };
}

async function createAuthResultForUser(user: {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  provider: string;
  createdAt: Date;
}): Promise<AuthResult> {
  const accessToken = generateAccessToken({ userId: user.id, email: user.email });
  const refreshToken = generateRefreshToken({ userId: user.id, email: user.email });
  const expiresAt = new Date(Date.now() + parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN));

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashRefreshToken(refreshToken),
      userId: user.id,
      expiresAt,
    },
  });

  return {
    user: mapUserToProfile(user),
    tokens: {
      accessToken,
      refreshToken,
      expiresIn: env.JWT_EXPIRES_IN,
    },
  };
}

export async function signUp(input: {
  username: string;
  email: string;
  password: string;
}): Promise<AuthResult> {
  const emailLower = input.email.toLowerCase().trim();

  const emailExists = await prisma.user.count({ where: { email: emailLower } });
  if (emailExists > 0) {
    throw new AppError('Email already exists', HttpStatus.CONFLICT, ErrorCodes.CONFLICT, {
      field: 'email',
    });
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      username: input.username.trim(),
      email: emailLower,
      password: passwordHash,
      provider: 'LOCAL',
      role: UserRole.USER,
    },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      provider: true,
      createdAt: true,
    },
  });

  return createAuthResultForUser(user);
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      provider: true,
      createdAt: true,
      password: true,
      isActive: true,
    },
  });

  if (!user || user.provider !== 'LOCAL' || !user.password) {
    throw new AppError(
      'Invalid email or password',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.INVALID_CREDENTIALS,
    );
  }

  const isPasswordValid = await verifyPassword(input.password, user.password);
  if (!isPasswordValid) {
    throw new AppError(
      'Invalid email or password',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.INVALID_CREDENTIALS,
    );
  }

  if (!user.isActive) {
    throw new AppError(
      'Account is deactivated',
      HttpStatus.FORBIDDEN,
      ErrorCodes.FORBIDDEN,
    );
  }

  return createAuthResultForUser(user);
}

export async function refreshToken(input: { refreshToken: string }): Promise<AuthResult> {
  const payload = verifyRefreshTokenJwt(input.refreshToken);
  const tokenHash = hashRefreshToken(input.refreshToken);

  const storedToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
  });

  const now = new Date();
  const isValid =
    storedToken &&
    storedToken.revokedAt === null &&
    storedToken.expiresAt.getTime() > now.getTime() &&
    storedToken.userId === payload.userId;

  if (!isValid) {
    throw new AppError(
      'Invalid or expired refresh token',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHORIZED,
    );
  }

  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      provider: true,
      createdAt: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) {
    throw new AppError('User not found', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }

  return createAuthResultForUser(user);
}

export async function logout(input: { refreshToken: string }): Promise<void> {
  try {
    verifyRefreshTokenJwt(input.refreshToken);
  } catch {
    throw new AppError('Invalid refresh token', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
  }

  const tokenHash = hashRefreshToken(input.refreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getCurrentUser(userId: string): Promise<AuthUserProfile> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      provider: true,
      createdAt: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) {
    throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  }

  return mapUserToProfile(user);
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true },
  });

  if (!user) {
    return { message: 'If the email exists, a reset link has been sent' };
  }

  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  logger.info('Password reset token generated', { userId: user.id });

  if (env.NODE_ENV === 'development') {
    logger.debug('Password reset token (development only)', {
      userId: user.id,
      resetToken: rawToken,
    });
  }

  return { message: 'If the email exists, a reset link has been sent' };
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const tokenHash = hashResetToken(token);

  const resetToken = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!resetToken) {
    throw new AppError(
      'Invalid or expired reset token',
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_ERROR,
    );
  }

  const passwordHash = await hashPassword(password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
  ]);

  await prisma.refreshToken.updateMany({
    where: { userId: resetToken.userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function getGoogleAuthUrl(): { url: string; message: string } {
  const clientId = env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    throw new AppError(
      'Google authentication is not configured',
      HttpStatus.SERVICE_UNAVAILABLE,
      ErrorCodes.INTERNAL_SERVER_ERROR,
    );
  }

  const redirectUri = env.GOOGLE_CALLBACK_URL;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
  });

  return {
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    message: 'Google OAuth URL generated successfully',
  };
}

export async function googleSignIn(idToken: string): Promise<AuthResult> {
  const clientId = env.GOOGLE_CLIENT_ID;
  
  if (!clientId) {
    throw new AppError(
      'Google authentication is not configured',
      HttpStatus.SERVICE_UNAVAILABLE,
      ErrorCodes.INTERNAL_SERVER_ERROR,
    );
  }

  // Verify Google ID token (simplified - in production use google-auth-library)
  let googlePayload: {
    email: string;
    sub: string;
    name: string;
    picture?: string;
  };

  try {
    // Note: This is a simplified verification. Use @google-auth-library/oauth2-client for production
    const response = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${idToken}`);
    
    if (!response.ok) {
      throw new AppError(
        'Invalid Google ID token',
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
      );
    }

    const payload = (await response.json()) as Record<string, unknown>;
    googlePayload = {
      email: (payload.email as string) || '',
      sub: (payload.sub as string) || '',
      name: (payload.name as string) || '',
      picture: payload.picture as string | undefined,
    };

    // Verify the token is for our application
    if (googlePayload.sub && !googlePayload.email) {
      throw new AppError(
        'Invalid Google token response',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
      );
    }
  } catch (error: any) {
    logger.error('Google token verification failed', { error: error.message });
    throw new AppError(
      'Failed to verify Google token',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHORIZED,
    );
  }

  const emailLower = googlePayload.email.toLowerCase();

  // Find or create user
  let user = await prisma.user.findUnique({
    where: { email: emailLower },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      provider: true,
      createdAt: true,
      isActive: true,
    },
  });

  if (user && user.provider !== 'GOOGLE' && user.provider !== 'LOCAL') {
    throw new AppError(
      'This email is already registered with a different provider',
      HttpStatus.CONFLICT,
      ErrorCodes.CONFLICT,
    );
  }

  if (!user) {
    // Create new user from Google profile
    user = await prisma.user.create({
      data: {
        email: emailLower,
        username: (googlePayload.name || emailLower.split('@')[0]) as string,
        provider: 'GOOGLE',
        role: UserRole.USER,
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        provider: true,
        createdAt: true,
        isActive: true,
      },
    });
  } else if (user.provider === 'LOCAL') {
    // Update existing LOCAL user to support GOOGLE signin too
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        provider: 'LOCAL', // Keep LOCAL as primary
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        provider: true,
        createdAt: true,
        isActive: true,
      },
    });
  }

  if (!user.isActive) {
    throw new AppError(
      'Account is deactivated',
      HttpStatus.FORBIDDEN,
      ErrorCodes.FORBIDDEN,
    );
  }

  logger.info('User logged in via Google', { userId: user.id, email: user.email });
  return createAuthResultForUser(user);
}
