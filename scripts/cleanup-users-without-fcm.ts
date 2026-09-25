/**
 * Manual / ops cleanup: users with ZERO valid FCM device tokens.
 *
 * DRY RUN (default — never deletes):
 *   npx tsx scripts/cleanup-users-without-fcm.ts
 *   DRY_RUN=true npx tsx scripts/cleanup-users-without-fcm.ts
 *
 * REAL deletion (explicit — REQUIRES LIMIT):
 *   DRY_RUN=false CONFIRM=DELETE_USERS_WITHOUT_FCM LIMIT=10 npx tsx scripts/cleanup-users-without-fcm.ts
 *
 * Bulk (>25) additionally requires:
 *   ALLOW_BULK=true
 *
 * Optional:
 *   BATCH_SIZE=25
 *
 * Does NOT schedule itself. Does NOT auto-run bulk deletes without CONFIRM + LIMIT (+ ALLOW_BULK).
 */
import '../src/load-env';
import {
  cleanupUsersWithoutFcm,
  REAL_DELETE_CONFIRM_PHRASE,
} from '../src/services/cleanup-users-without-fcm.service';
import { prisma } from '../src/lib/prisma';

function envFlag(name: string, defaultTrue = true): boolean {
  const raw = process.env[name];
  if (raw == null || raw === '') return defaultTrue;
  const v = raw.trim().toLowerCase();
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  return defaultTrue;
}

async function main() {
  const dryRun = envFlag('DRY_RUN', true);
  const confirm = process.env.CONFIRM?.trim();
  const limit = process.env.LIMIT ? Number(process.env.LIMIT) : undefined;
  const batchSize = process.env.BATCH_SIZE ? Number(process.env.BATCH_SIZE) : undefined;
  const allowBulk = envFlag('ALLOW_BULK', false);

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        mode: dryRun ? 'DRY_RUN' : 'REAL_DELETE',
        confirmProvided: confirm === REAL_DELETE_CONFIRM_PHRASE,
        limit: limit ?? null,
        batchSize: batchSize ?? null,
        allowBulk,
      },
      null,
      2,
    ),
  );

  const result = await cleanupUsersWithoutFcm({
    dryRun,
    confirm,
    limit: Number.isFinite(limit) ? limit : undefined,
    batchSize: Number.isFinite(batchSize) ? batchSize : undefined,
    allowBulk,
  });

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
