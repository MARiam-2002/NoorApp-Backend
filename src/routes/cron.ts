import { Router } from 'express';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus, env } from '../config';
import { runPrayerReminderCron } from '../services/prayer-reminder.service';
import {
  cleanupUsersWithoutFcm,
  REAL_DELETE_CONFIRM_PHRASE,
} from '../services/cleanup-users-without-fcm.service';

export const cronRouter = Router();

/**
 * Pure cron auth check (no Vercel header bypass).
 * Empty/missing secret → never authorized.
 */
export function isCronRequestAuthorized(
  configuredSecret: string | undefined | null,
  req: {
    headers: Record<string, unknown>;
    query: Record<string, unknown>;
  },
): boolean {
  const secret = (configuredSecret || '').trim();
  if (!secret) return false;

  const header = String(req.headers['authorization'] ?? '');
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const querySecret = typeof req.query.secret === 'string' ? req.query.secret : '';
  const headerSecret = String(req.headers['x-cron-secret'] ?? '');

  return bearer === secret || querySecret === secret || headerSecret === secret;
}

function assertCronAuthorized(req: {
  headers: Record<string, unknown>;
  query: Record<string, unknown>;
}) {
  const secret = env.CRON_SECRET || process.env.CRON_SECRET || '';
  if (!isCronRequestAuthorized(secret, req)) {
    throw new AppError('Cron unauthorized', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }
}

/**
 * @openapi
 * /cron/prayer-reminders:
 *   post:
 *     tags: ['Cron']
 *     summary: FCM reminders cron — Azan backup + Pray-for-the-Prophet ﷺ
 *     description: |
 *       Same scheduler (~every 10 minutes). Runs Azan prayer-window pushes, then
 *       Salawat reminders (opt-in; user interval 30/60/120/180 min; active HH:mm window in user timezone).
 *       Auth: Authorization Bearer CRON_SECRET, X-Cron-Secret, or ?secret= (no Vercel bypass).
 */
cronRouter.post(
  '/prayer-reminders',
  asyncHandler(async (req, res) => {
    assertCronAuthorized(req as any);
    const data = await runPrayerReminderCron(12);
    sendSuccess(res, data, 'Prayer reminder cron completed', req);
  }),
);

cronRouter.get(
  '/prayer-reminders',
  asyncHandler(async (req, res) => {
    assertCronAuthorized(req as any);
    const data = await runPrayerReminderCron(12);
    sendSuccess(res, data, 'Prayer reminder cron completed', req);
  }),
);

/**
 * @openapi
 * /cron/cleanup-users-without-fcm:
 *   post:
 *     tags: ['Cron']
 *     summary: Manual maintenance — delete users with zero valid FCM tokens
 *     description: |
 *       NOT scheduled automatically. Auth: CRON_SECRET.
 *       Default dryRun=true (count only). Real delete requires
 *       body.dryRun=false AND body.confirm=DELETE_USERS_WITHOUT_FCM.
 *       Reuses the same hard-delete path as DELETE /auth/me.
 */
cronRouter.post(
  '/cleanup-users-without-fcm',
  asyncHandler(async (req, res) => {
    assertCronAuthorized(req as any);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const dryRun = body.dryRun !== false && body.dryRun !== 'false';
    const confirm = typeof body.confirm === 'string' ? body.confirm : undefined;
    const limit = body.limit != null ? Number(body.limit) : undefined;
    const batchSize = body.batchSize != null ? Number(body.batchSize) : undefined;
    const allowBulk = body.allowBulk === true || body.allowBulk === 'true';

    if (!dryRun && confirm !== REAL_DELETE_CONFIRM_PHRASE) {
      throw new AppError(
        `Real deletion requires confirm="${REAL_DELETE_CONFIRM_PHRASE}"`,
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    const data = await cleanupUsersWithoutFcm({
      dryRun,
      confirm,
      limit: Number.isFinite(limit) ? limit : undefined,
      batchSize: Number.isFinite(batchSize) ? batchSize : undefined,
      allowBulk,
    });
    sendSuccess(
      res,
      data,
      dryRun ? 'Dry-run: users without valid FCM counted' : 'Cleanup users without FCM completed',
      req,
    );
  }),
);
