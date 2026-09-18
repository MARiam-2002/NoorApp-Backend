/**
 * Sadaqah goal edit — validation + progress preservation (DB + unit).
 *   npx tsx scripts/test-sadaqah-goal.ts
 */
import '../src/load-env';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { AppError } from '../src/lib/errors';
import * as authService from '../src/services/auth.service';
import {
  getSadaqahToday,
  getUserSadaqahGoal,
  updateSadaqah,
} from '../src/services/journey.service';
import { sadaqahSchema } from '../src/routes/journey';
import {
  DEFAULT_SADAQAH_GOAL_EGP,
  sadaqahProgressPercent,
} from '../src/shared/constants/sadaqah';

let failed = 0;
function pass(name: string) {
  console.log(`PASS  ${name}`);
}
function fail(name: string, detail?: string) {
  failed += 1;
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
}

assert.equal(sadaqahSchema.safeParse({ amount: 350 }).success, true);
assert.equal(sadaqahSchema.safeParse({ goal: 1000 }).success, true);
assert.equal(sadaqahSchema.safeParse({ amount: 350, goal: 2000 }).success, true);
assert.equal(sadaqahSchema.safeParse({}).success, false);
assert.equal(sadaqahSchema.safeParse({ goal: 0 }).success, false);
assert.equal(sadaqahSchema.safeParse({ goal: -10 }).success, false);
assert.equal(sadaqahSchema.safeParse({ goal: 'abc' }).success, false);
assert.equal(sadaqahSchema.safeParse({ amount: -1 }).success, false);
assert.equal(sadaqahSchema.safeParse({ goal: 1_000_001 }).success, false);
assert.equal(sadaqahProgressPercent(350, 1000), 35);
assert.equal(sadaqahProgressPercent(350, 2000), 18);
pass('validation + percent math');

async function dbTests() {
  if (!process.env.DATABASE_URL) {
    console.log('SKIP  DATABASE_URL not set — DB tests not run');
    return;
  }

  const stamp = Date.now();
  const a = await authService.signUp({
    fullName: 'Sadaqah A',
    email: `sadaqah-a-${stamp}@example.com`,
    password: 'SadaqahTest123!',
  });
  const b = await authService.signUp({
    fullName: 'Sadaqah B',
    email: `sadaqah-b-${stamp}@example.com`,
    password: 'SadaqahTest123!',
  });

  try {
    const def = await getSadaqahToday(a.user.id);
    def.goal === DEFAULT_SADAQAH_GOAL_EGP && def.amount === 0
      ? pass('default goal 1000, amount 0')
      : fail('default', JSON.stringify(def));

    await updateSadaqah(a.user.id, { amount: 350 });
    const afterAmount = await getSadaqahToday(a.user.id);
    afterAmount.amount === 350 && afterAmount.goal === 1000
      ? pass('set amount 350 keeps default goal')
      : fail('set amount', JSON.stringify(afterAmount));

    const raised = await updateSadaqah(a.user.id, { goal: 2000 });
    raised.goal === 2000 && raised.amount === 350 && raised.sadaqahAmount === 350
      ? pass('goal 2000 preserves progress 350')
      : fail('raise goal', JSON.stringify(raised));

    const lowered = await updateSadaqah(a.user.id, { goal: 500 });
    lowered.goal === 500 && lowered.amount === 350
      ? pass('decrease goal keeps progress 350')
      : fail('decrease goal', JSON.stringify(lowered));

    await updateSadaqah(a.user.id, { goal: 1500 });
    await updateSadaqah(a.user.id, { goal: 2500 });
    const multi = await getSadaqahToday(a.user.id);
    multi.goal === 2500 && multi.amount === 350
      ? pass('repeated goal updates persist; amount unchanged')
      : fail('repeat', JSON.stringify(multi));

    const reread = await getUserSadaqahGoal(a.user.id);
    reread === 2500 ? pass('goal survives reload') : fail('reload', String(reread));

    const other = await getSadaqahToday(b.user.id);
    other.goal === 1000 && other.amount === 0
      ? pass('user B isolated from user A goal/amount')
      : fail('isolation', JSON.stringify(other));

    try {
      await updateSadaqah(a.user.id, { goal: 0 });
      fail('goal 0 rejected');
    } catch (err) {
      err instanceof AppError && err.statusCode === 400
        ? pass('goal 0 rejected')
        : fail('goal 0', String(err));
    }

    try {
      await updateSadaqah(a.user.id, { goal: -5 });
      fail('negative goal rejected');
    } catch (err) {
      err instanceof AppError && err.statusCode === 400
        ? pass('negative goal rejected')
        : fail('negative goal', String(err));
    }

    await authService.deleteAccount(a.user.id);
    const gone = await prisma.user.findUnique({ where: { id: a.user.id } });
    gone ? fail('user A deleted') : pass('account delete removes goal with user');
  } finally {
    await prisma.user.delete({ where: { id: b.user.id } }).catch(() => null);
    await prisma.deletedIdentity.deleteMany({
      where: { email: { contains: `sadaqah-` } },
    }).catch(() => null);
  }
}

dbTests()
  .catch((err) => {
    console.error(err);
    failed += 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    if (failed > 0) process.exit(1);
    console.log('sadaqah goal tests: OK');
  });
