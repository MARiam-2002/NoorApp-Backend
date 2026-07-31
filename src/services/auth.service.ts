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

function generateUsernameFromEmail(email: string): string {
  const localPart = email.toLowerCase().split('@')[0] || 'user';
  const base = localPart.replace(/[^a-z0-9_]/gi, '_').slice(0, 20);
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${base || 'user'}_${suffix}`;
}

function normalizeUsername(username: string): string {
  return username.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 30);
}

async function ensureUniqueUsername(preferred: string, attempt = 0): Promise<string> {
  let candidate = attempt === 0
    ? normalizeUsername(preferred || generateUsernameFromEmail(preferred))
    : `${normalizeUsername(preferred).slice(0, 24)}_${1000 + Math.floor(Math.random() * 9000)}`;
  const exists = await prisma.user.count({
    where: { username: { equals: candidate, mode: 'insensitive' } },
  });
  if (exists === 0) return candidate;
  if (attempt > 10) {
    const uuid = Math.random().toString(36).slice(2, 10);
    return `user_${uuid}`;
  }
  return ensureUniqueUsername(preferred, attempt + 1);
}

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
};

export type AuthUserProfile = {
  id: string;
  username: string;
  fullName: string | null;
  email: string;
  role: string;
  provider: string;
  /**
   * Stable provider-level user ID. For GOOGLE users this equals the `sub`
   * claim in the Google ID token. Stored in User.googleId. Can be used by
   * Flutter to distinguish first-time vs returning Google sign-ins alongside
   * the response HTTP status (201 vs 200).
   */
  providerId: string | null;
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
  fullName: string | null;
  email: string;
  role: UserRole;
  provider: string;
  providerId: string | null;
  googleId: string | null;
  createdAt: Date;
}): AuthUserProfile {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName ?? null,
    email: user.email,
    role: user.role,
    provider: user.provider,
    providerId: user.googleId ?? user.providerId ?? null,
    createdAt: user.createdAt,
  };
}

async function createAuthResultForUser(user: {
  id: string;
  username: string;
  fullName: string | null;
  email: string;
  role: UserRole;
  provider: string;
  providerId: string | null;
  googleId: string | null;
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
  username?: string;
  fullName?: string | null;
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

  const preferredUsername = input.username?.trim()
    ? input.username.trim()
    : generateUsernameFromEmail(emailLower);

  const username = await ensureUniqueUsername(preferredUsername);

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      username,
      fullName: input.fullName ? input.fullName.trim() : null,
      email: emailLower,
      password: passwordHash,
      provider: 'LOCAL',
      role: UserRole.USER,
    },
    select: {
      id: true,
      username: true,
      fullName: true,
      email: true,
      role: true,
      provider: true,
      providerId: true,
      googleId: true,
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
      fullName: true,
      email: true,
      role: true,
      provider: true,
      providerId: true,
      googleId: true,
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
      fullName: true,
      email: true,
      role: true,
      provider: true,
      providerId: true,
      googleId: true,
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
      fullName: true,
      email: true,
      role: true,
      provider: true,
      providerId: true,
      googleId: true,
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
      'Google authentication is not configured on the server: set GOOGLE_CLIENT_ID in environment variables. (Note: the POST /auth/google endpoint that accepts idToken works WITHOUT this env variable set; only the server-initiated OAuth URL needs it.)',
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
  if (!idToken?.trim()) {
    throw new AppError(
      'idToken is required',
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_ERROR,
    );
  }

  // Verify Google ID token against Google's public tokeninfo endpoint.
  // This flow works WITHOUT GOOGLE_CLIENT_ID being set on the server:
  // Flutter (using google_sign_in SDK) obtains a token whose `aud` already matches
  // the OAuth client ID registered on Google Cloud. For extra strictness you can
  // additionally check `aud === env.GOOGLE_CLIENT_ID` below, but it is not required.
  let googlePayload: {
    email: string;
    sub: string;
    name: string;
    picture?: string;
  };

  try {
    const response = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${encodeURIComponent(idToken)}`);

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

    if (googlePayload.sub && !googlePayload.email) {
      throw new AppError(
        'Invalid Google token response',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    // Optional strict audience check. If GOOGLE_CLIENT_ID is set on the server,
    // we verify the token was indeed issued for our app. When unset we skip
    // (google_sign_in SDK already enforces this client-side via project settings).
    if (env.GOOGLE_CLIENT_ID && payload.aud) {
      const aud = String(payload.aud);
      if (aud !== env.GOOGLE_CLIENT_ID) {
        throw new AppError(
          'Google ID token audience does not match this server',
          HttpStatus.UNAUTHORIZED,
          ErrorCodes.UNAUTHORIZED,
        );
      }
    }
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error('Google token verification failed', { error: error.message });
    throw new AppError(
      'Failed to verify Google token',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHORIZED,
    );
  }

  const emailLower = googlePayload.email.toLowerCase();

  // Priority lookup order:
  //   1. By googleId (the sub claim from Google) — handles users who changed
  //      their primary Google email but still own the same Google account.
  //   2. By email — covers first-time sign-ins AND existing LOCAL users whose
  //      email already matched.
  let user =
    (googlePayload.sub
      ? await prisma.user.findUnique({
          where: { googleId: googlePayload.sub },
          select: {
            id: true,
            username: true,
            fullName: true,
            email: true,
            role: true,
            provider: true,
            providerId: true,
            googleId: true,
            createdAt: true,
            isActive: true,
          },
        })
      : null) ??
    (await prisma.user.findUnique({
      where: { email: emailLower },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        role: true,
        provider: true,
        providerId: true,
        googleId: true,
        createdAt: true,
        isActive: true,
      },
    }));

  if (user && user.provider !== 'GOOGLE' && user.provider !== 'LOCAL') {
    throw new AppError(
      'This email is already registered with a different provider',
      HttpStatus.CONFLICT,
      ErrorCodes.CONFLICT,
    );
  }

  if (!user) {
    // Create new user from Google profile. Always store googleId so we can
    // find this user back even if the primary Google email changes later.
    user = await prisma.user.create({
      data: {
        email: emailLower,
        username: (googlePayload.name || emailLower.split('@')[0]) as string,
        fullName: googlePayload.name || null,
        provider: 'GOOGLE',
        providerId: googlePayload.sub || null,
        googleId: googlePayload.sub || null,
        role: UserRole.USER,
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        role: true,
        provider: true,
        providerId: true,
        googleId: true,
        createdAt: true,
        isActive: true,
      },
    });
  } else {
    // Existing user (either GOOGLE or LOCAL provider).
    // Back-fill googleId if missing (covers both a previously LOCAL user who
    // now signs in with Google, and an older GOOGLE user whose googleId was
    // never stored because the server did not persist it yet).
    const needsGoogleId = !user.googleId && googlePayload.sub;
    const needsProviderId = !user.providerId && googlePayload.sub;
    const wantsName = !user.fullName && googlePayload.name;

    if (needsGoogleId || needsProviderId || wantsName) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          ...(needsGoogleId ? { googleId: googlePayload.sub } : {}),
          ...(needsProviderId ? { providerId: googlePayload.sub } : {}),
          ...(wantsName ? { fullName: googlePayload.name } : {}),
          // Keep whatever primary provider was set originally (LOCAL stays LOCAL,
          // GOOGLE stays GOOGLE) — never demote a LOCAL user who later signs in
          // via Google, so they can still use their password too.
        },
        select: {
          id: true,
          username: true,
          fullName: true,
          email: true,
          role: true,
          provider: true,
          providerId: true,
          googleId: true,
          createdAt: true,
          isActive: true,
        },
      });
    }
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
