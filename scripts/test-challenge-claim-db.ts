import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { assertSafeDatabaseTarget } from '../src/lib/database-safety';
import { claimChallenge } from '../src/services/challenge.service';
import { calendarDayOfYear, localDayKeyForTimezone, dateOnlyFromDayKey } from '../src/shared/utils/user-local-date';

async function main() {
  if (process.env.SECURITY_DB_TEST !== 'true') {
    console.log('SKIP challenge DB integration: set SECURITY_DB_TEST=true on an isolated *_test database.'); return;
  }
  assertSafeDatabaseTarget(process.env.DATABASE_URL ?? '', 'test');
  const db = new PrismaClient();
  const schema = `challenge_security_${randomUUID().replaceAll('-', '')}`;
  let created = false;
  const original = { tx: prisma.$transaction, find: prisma.user.findUnique, update: prisma.user.update,
    template: prisma.dailyChallengeTemplate.findFirst, journey: prisma.dailyProgress.upsert,
    prayers: prisma.prayerCompletion.findMany, notification: prisma.notification.create };
  const scoped = (run: any) => db.$transaction(async tx => {
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
    return run(tx);
  }, { maxWait: 20_000, timeout: 20_000 });
  try {
    await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`); created = true;
    await scoped(async (tx: any) => {
      await tx.$executeRawUnsafe('CREATE TABLE users(id TEXT PRIMARY KEY, timezone TEXT, points INTEGER DEFAULT 0, level INTEGER DEFAULT 1)');
      await tx.$executeRawUnsafe('CREATE TABLE challenge_completions(id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,"userId" TEXT REFERENCES users(id) ON DELETE CASCADE,"dayOfYear" INTEGER,"completedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,"claimedAt" TIMESTAMP(3))');
      await tx.$executeRawUnsafe('CREATE UNIQUE INDEX "challenge_completions_userId_dayOfYear_key" ON challenge_completions("userId","dayOfYear")');
      await tx.$executeRaw`INSERT INTO users(id,timezone) VALUES ('qa','Africa/Cairo'),('legacy','Africa/Cairo')`;
      await tx.$executeRaw`INSERT INTO challenge_completions("userId","dayOfYear","completedAt","claimedAt") VALUES ('legacy',182,'2025-07-01','2025-07-01')`;
      for (const sql of readFileSync('prisma/migrations/20261020120000_challenge_claim_year/migration.sql', 'utf8').split(';').map(s => s.trim()).filter(Boolean)) {
        await tx.$executeRawUnsafe(sql);
      }
      const legacy = await tx.$queryRaw`SELECT year FROM challenge_completions WHERE "userId"='legacy'`;
      assert.equal(legacy[0].year, 2025, 'Migration retains historical claim year');
    });
    prisma.$transaction = scoped as any;
    prisma.user.findUnique = ((args: any) => scoped((tx: any) => tx.user.findUnique(args))) as any;
    prisma.user.update = ((args: any) => scoped((tx: any) => tx.user.update(args))) as any;
    prisma.dailyChallengeTemplate.findFirst = (async () => ({ type: 'QURAN_PAGES', targetValue: 1, rewardPoints: 50 })) as any;
    prisma.dailyProgress.upsert = (async () => ({ quranPagesRead: 1, adhkarCompleted: false, sadaqahAmount: 0 })) as any;
    prisma.prayerCompletion.findMany = (async () => []) as any;
    prisma.notification.create = (async () => ({})) as any;
    const date = dateOnlyFromDayKey(localDayKeyForTimezone('Africa/Cairo'));
    const day = calendarDayOfYear(date);
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => claimChallenge('qa', String(day))));
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.ok(results.filter(r => r.status === 'rejected').every((r: any) => r.reason.statusCode === 409));
    const points = await scoped((tx: any) => tx.$queryRaw`SELECT points FROM users WHERE id='qa'`);
    assert.equal(points[0].points, 50);
    console.log('Challenge PostgreSQL integration passed: real migration preservation, independent concurrent claims and exactly one points increment. Dedicated test schema only.');
  } finally {
    prisma.$transaction = original.tx; prisma.user.findUnique = original.find; prisma.user.update = original.update;
    prisma.dailyChallengeTemplate.findFirst = original.template; prisma.dailyProgress.upsert = original.journey;
    prisma.prayerCompletion.findMany = original.prayers; prisma.notification.create = original.notification;
    if (created && /^challenge_security_[a-f0-9]{32}$/.test(schema)) await db.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await db.$disconnect(); await prisma.$disconnect();
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
