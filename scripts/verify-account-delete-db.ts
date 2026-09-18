/**
 * DB-level Play account-deletion checks (requires DATABASE_URL + JWT secrets).
 * Run: npx tsx scripts/verify-account-delete-db.ts
 */
import '../src/load-env';
import { prisma } from '../src/lib/prisma';
import { AppError } from '../src/lib/errors';
import * as authService from '../src/services/auth.service';

let failed = 0;

function pass(name: string): void {
  console.log(`PASS  ${name}`);
}

function fail(name: string, detail?: string): void {
  failed += 1;
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.log('SKIP  DATABASE_URL not set — DB-level delete checks not run');
    return;
  }

  const stamp = Date.now();
  const email = `play-delete-db-${stamp}@example.com`;
  const password = 'PlayDelete123!';
  const fcmToken = `smoke-fcm-token-${stamp}-abcdefghij`;

  const created = await authService.signUp({
    fullName: 'Play Delete DB',
    email,
    password,
  });
  const userId = created.user.id;
  const refreshToken = created.tokens.refreshToken;

  await prisma.deviceToken.create({
    data: { userId, token: fcmToken, platform: 'android' },
  });
  await prisma.notification.create({
    data: {
      userId,
      titleAr: 'حذف',
      titleEn: 'delete',
      bodyAr: 'اختبار',
      bodyEn: 'test',
    },
  });

  const result = await authService.deleteAccount(userId);
  if (result.deleted !== true || typeof result.deletedAt !== 'string') {
    fail('deleteAccount return shape', JSON.stringify(result));
  } else {
    pass('deleteAccount returns { deleted: true, deletedAt }');
  }

  const gone = await prisma.user.findUnique({ where: { id: userId } });
  gone ? fail('user row removed') : pass('user row hard-deleted');

  const tokens = await prisma.deviceToken.count({ where: { userId } });
  tokens === 0 ? pass('FCM device rows gone') : fail('FCM device rows gone', `count=${tokens}`);

  const refreshRows = await prisma.refreshToken.count({ where: { userId } });
  refreshRows === 0 ? pass('refresh sessions gone') : fail('refresh sessions gone', `count=${refreshRows}`);

  const notesByUser = await prisma.notification.count({ where: { userId } });
  notesByUser === 0
    ? pass('notification rows gone')
    : fail('notification rows gone', `count=${notesByUser}`);

  const block = await prisma.deletedIdentity.findUnique({ where: { email } });
  block ? pass('deleted identity recorded') : fail('deleted identity recorded');

  try {
    await authService.login({ email, password });
    fail('login after delete throws 401');
  } catch (err) {
    const code = err instanceof AppError ? err.statusCode : 0;
    code === 401 ? pass('login after delete → 401') : fail('login after delete → 401', String(err));
  }

  try {
    await authService.refreshToken({ refreshToken });
    fail('refresh after delete throws 401');
  } catch (err) {
    const code = err instanceof AppError ? err.statusCode : 0;
    code === 401 ? pass('refresh after delete → 401') : fail('refresh after delete → 401', String(err));
  }

  await prisma.deletedIdentity.deleteMany({ where: { email } });
}

main()
  .catch((err) => {
    console.error(err);
    failed += 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    if (failed > 0) process.exit(1);
  });
