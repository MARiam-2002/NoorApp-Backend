import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { hardDeleteUserAccount } from './auth.service';

/** Same minimum length enforced by registerDeviceToken. */
export const MIN_VALID_FCM_TOKEN_LENGTH = 10;

export const NO_VALID_FCM_DEVICE_REASON = 'NO_VALID_FCM_DEVICE' as const;

/**
 * Database-state definition of a valid registered FCM token.
 * Does NOT use FCM delivery success/failure — only stored token string quality.
 */
export function isValidFcmTokenValue(token: string | null | undefined): boolean {
  if (typeof token !== 'string') return false;
  return token.trim().length >= MIN_VALID_FCM_TOKEN_LENGTH;
}

export type EligibleNoFcmUser = {
  id: string;
  email: string;
  isActive: boolean;
  createdAt: Date;
  deviceRowCount: number;
  reason: typeof NO_VALID_FCM_DEVICE_REASON;
};

export type CleanupUsersWithoutFcmOptions = {
  dryRun: boolean;
  /** Required when dryRun=false. Must equal DELETE_USERS_WITHOUT_FCM. */
  confirm?: string;
  batchSize?: number;
  /**
   * REQUIRED for real deletion (safety). Caps how many eligible users are processed.
   * Dry-run may omit limit to count everyone.
   */
  limit?: number;
  /**
   * Extra guard for real deletion of more than 25 users.
   * Must be true when limit > 25.
   */
  allowBulk?: boolean;
  /** Optional allow-list — only these user IDs may be considered (tests / targeted ops). */
  onlyUserIds?: string[];
  /**
   * Test/ops hook invoked after the eligibility scan and before per-user delete.
   * Used to simulate "FCM registered after scan" races — not for production cron.
   */
  onAfterScan?: (eligibleIds: string[]) => Promise<void>;
};

export type CleanupUsersWithoutFcmResult = {
  dryRun: boolean;
  databaseHost: string | null;
  eligibleUsers: number;
  deletedUsers: number;
  skippedUsers: number;
  failedUsers: number;
  raceSkippedUsers: number;
  reason: typeof NO_VALID_FCM_DEVICE_REASON;
  eligibleSample: Array<{ id: string; email: string; isActive: boolean; deviceRowCount: number }>;
  deletedIds: string[];
  skipped: Array<{ id: string; reason: string }>;
  failures: Array<{ id: string; message: string }>;
};

export const REAL_DELETE_CONFIRM_PHRASE = 'DELETE_USERS_WITHOUT_FCM';

export function describeDatabaseHost(databaseUrl = process.env.DATABASE_URL || ''): string | null {
  try {
    const u = new URL(databaseUrl);
    return u.hostname || null;
  } catch {
    return null;
  }
}

/** True if the user currently has ≥1 valid FCM device token in DB. */
export async function userHasValidFcmDevice(userId: string): Promise<boolean> {
  const rows = await prisma.deviceToken.findMany({
    where: { userId },
    select: { token: true },
  });
  return rows.some((r) => isValidFcmTokenValue(r.token));
}

/**
 * Find users with ZERO valid FCM devices/tokens.
 * Users with any valid token (multi-device) are excluded.
 * Uses SQL NOT EXISTS so we do not load the full user table into memory.
 */
export async function findUsersWithNoValidFcmDevice(options?: {
  limit?: number;
  onlyUserIds?: string[];
}): Promise<EligibleNoFcmUser[]> {
  const limit =
    options?.limit && options.limit > 0 ? Math.floor(options.limit) : null;
  const onlyIds = (options?.onlyUserIds ?? []).filter(Boolean);

  type Row = {
    id: string;
    email: string;
    isActive: boolean;
    createdAt: Date;
    deviceRowCount: bigint | number;
  };

  const rows = onlyIds.length
    ? await prisma.$queryRaw<Row[]>`
        SELECT
          u.id,
          u.email,
          u."isActive",
          u."createdAt",
          (
            SELECT COUNT(*)::int FROM device_tokens d2 WHERE d2."userId" = u.id
          ) AS "deviceRowCount"
        FROM users u
        WHERE u.id IN (${Prisma.join(onlyIds)})
          AND NOT EXISTS (
            SELECT 1
            FROM device_tokens d
            WHERE d."userId" = u.id
              AND LENGTH(TRIM(d.token)) >= ${MIN_VALID_FCM_TOKEN_LENGTH}
          )
        ORDER BY u."createdAt" ASC
        ${limit ? Prisma.sql`LIMIT ${limit}` : Prisma.empty}
      `
    : limit
      ? await prisma.$queryRaw<Row[]>`
          SELECT
            u.id,
            u.email,
            u."isActive",
            u."createdAt",
            (
              SELECT COUNT(*)::int FROM device_tokens d2 WHERE d2."userId" = u.id
            ) AS "deviceRowCount"
          FROM users u
          WHERE NOT EXISTS (
            SELECT 1
            FROM device_tokens d
            WHERE d."userId" = u.id
              AND LENGTH(TRIM(d.token)) >= ${MIN_VALID_FCM_TOKEN_LENGTH}
          )
          ORDER BY u."createdAt" ASC
          LIMIT ${limit}
        `
      : await prisma.$queryRaw<Row[]>`
          SELECT
            u.id,
            u.email,
            u."isActive",
            u."createdAt",
            (
              SELECT COUNT(*)::int FROM device_tokens d2 WHERE d2."userId" = u.id
            ) AS "deviceRowCount"
          FROM users u
          WHERE NOT EXISTS (
            SELECT 1
            FROM device_tokens d
            WHERE d."userId" = u.id
              AND LENGTH(TRIM(d.token)) >= ${MIN_VALID_FCM_TOKEN_LENGTH}
          )
          ORDER BY u."createdAt" ASC
        `;

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    isActive: Boolean(r.isActive),
    createdAt: r.createdAt,
    deviceRowCount: Number(r.deviceRowCount ?? 0),
    reason: NO_VALID_FCM_DEVICE_REASON,
  }));
}

/**
 * Maintenance cleanup: delete accounts that have zero valid FCM tokens,
 * reusing hardDeleteUserAccount (same path as DELETE /auth/me).
 *
 * Default dryRun=true. Real deletion requires confirm phrase.
 */
export async function cleanupUsersWithoutFcm(
  options: CleanupUsersWithoutFcmOptions,
): Promise<CleanupUsersWithoutFcmResult> {
  const dryRun = options.dryRun !== false;
  const batchSize = Math.max(1, Math.min(200, options.batchSize ?? 50));
  const limit = options.limit && options.limit > 0 ? Math.floor(options.limit) : undefined;

  if (!dryRun && options.confirm !== REAL_DELETE_CONFIRM_PHRASE) {
    throw new Error(
      `Refusing real deletion: set confirm="${REAL_DELETE_CONFIRM_PHRASE}" (and DRY_RUN=false).`,
    );
  }
  if (!dryRun && (limit == null || limit <= 0)) {
    throw new Error(
      'Refusing real deletion without LIMIT (set LIMIT to a positive integer, e.g. LIMIT=10).',
    );
  }
  if (!dryRun && limit! > 25 && options.allowBulk !== true) {
    throw new Error(
      'Refusing real deletion of more than 25 users without allowBulk=true (ALLOW_BULK=true).',
    );
  }

  const eligible = await findUsersWithNoValidFcmDevice({
    limit,
    onlyUserIds: options.onlyUserIds,
  });
  const sample = eligible.slice(0, 25).map((u) => ({
    id: u.id,
    email: u.email,
    isActive: u.isActive,
    deviceRowCount: u.deviceRowCount,
  }));

  const result: CleanupUsersWithoutFcmResult = {
    dryRun,
    databaseHost: describeDatabaseHost(),
    eligibleUsers: eligible.length,
    deletedUsers: 0,
    skippedUsers: 0,
    failedUsers: 0,
    raceSkippedUsers: 0,
    reason: NO_VALID_FCM_DEVICE_REASON,
    eligibleSample: sample,
    deletedIds: [],
    skipped: [],
    failures: [],
  };

  if (dryRun) {
    logger.info('[CleanupNoFcm] Dry-run complete', {
      eligibleUsers: result.eligibleUsers,
      databaseHost: result.databaseHost,
    });
    return result;
  }

  if (options.onAfterScan) {
    await options.onAfterScan(eligible.map((u) => u.id));
  }

  for (let i = 0; i < eligible.length; i += batchSize) {
    const batch = eligible.slice(i, i + batchSize);
    for (const candidate of batch) {
      try {
        // Race re-check: token may have been registered after the scan.
        const stillNoValid = !(await userHasValidFcmDevice(candidate.id));
        if (!stillNoValid) {
          result.skippedUsers += 1;
          result.raceSkippedUsers += 1;
          result.skipped.push({
            id: candidate.id,
            reason: 'FCM_TOKEN_REGISTERED_AFTER_SCAN',
          });
          logger.info('[CleanupNoFcm] Skipped — FCM appeared before delete', {
            userId: candidate.id,
          });
          continue;
        }

        const exists = await prisma.user.findUnique({
          where: { id: candidate.id },
          select: { id: true },
        });
        if (!exists) {
          result.skippedUsers += 1;
          result.skipped.push({ id: candidate.id, reason: 'USER_ALREADY_GONE' });
          continue;
        }

        await hardDeleteUserAccount(candidate.id);
        result.deletedUsers += 1;
        result.deletedIds.push(candidate.id);
      } catch (err) {
        result.failedUsers += 1;
        const message = (err as Error)?.message || 'unknown';
        result.failures.push({ id: candidate.id, message });
        logger.warn('[CleanupNoFcm] Failed to delete user', {
          userId: candidate.id,
          message,
        });
      }
    }
  }

  logger.info('[CleanupNoFcm] Real cleanup finished', {
    eligibleUsers: result.eligibleUsers,
    deletedUsers: result.deletedUsers,
    skippedUsers: result.skippedUsers,
    raceSkippedUsers: result.raceSkippedUsers,
    failedUsers: result.failedUsers,
    databaseHost: result.databaseHost,
  });

  return result;
}
