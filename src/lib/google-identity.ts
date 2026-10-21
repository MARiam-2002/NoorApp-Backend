import { OAuth2Client } from 'google-auth-library';
import { env, ErrorCodes, HttpStatus } from '../config';
import { AppError } from './errors';

const client = new OAuth2Client({ transporterOptions: { timeout: 10_000, retry: false } });

export function googleAudiences(config = env): string[] {
  return [...new Set([config.GOOGLE_CLIENT_ID, config.GOOGLE_SERVER_CLIENT_ID, config.GOOGLE_CLIENT_IDS]
    .flatMap(value => value.split(',')).map(value => value.trim()).filter(Boolean))];
}

/** The SDK verifies Google's signature, issuer, expiry and explicit audience allowlist. */
export async function verifyGoogleIdentity(idToken: string) {
  const audience = googleAudiences();
  if (!audience.length) {
    throw new AppError('Google sign-in is not configured', HttpStatus.SERVICE_UNAVAILABLE, ErrorCodes.INTERNAL_SERVER_ERROR);
  }
  try {
    const ticket = await client.verifyIdToken({ idToken, audience });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || payload.email_verified !== true ||
        typeof payload.aud !== 'string' || !audience.includes(payload.aud)) {
      throw new Error('Invalid Google identity');
    }
    return { sub: payload.sub, email: payload.email, name: payload.name ?? '', picture: payload.picture };
  } catch {
    // Never log token contents or upstream request URLs containing identity credentials.
    throw new AppError('Invalid Google ID token', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }
}
