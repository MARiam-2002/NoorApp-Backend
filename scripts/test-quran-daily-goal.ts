import assert from 'node:assert/strict';
import { resolveQuranDailyGoal, type QuranPlanRow } from '../src/shared/utils/quran-daily-goal';
import { buildPlanDto } from '../src/services/khatmah-plan.service';
import { getDailyQuranGoal } from '../src/services/quran-daily-goal.service';
import { prisma } from '../src/lib/prisma';

async function main() {
  const now = new Date('2026-10-10T09:00:00Z');
  const row: QuranPlanRow & { planJuzPerMonth: number | null; dailyWardPages: number | null } = {
    planMode: 'DURATION_DAYS', planStartedAt: now, planPagesAtStart: 0,
    planDurationDays: 30, planTargetEndAt: new Date('2026-11-09T09:00:00Z'),
    totalPagesRead: 0, planJuzPerMonth: null, dailyWardPages: 21,
  };
  assert.equal(resolveQuranDailyGoal(null, 4, now).pagesTarget, 5);
  assert.equal(resolveQuranDailyGoal(null, 4, now).remainingToday, 1);
  assert.equal(resolveQuranDailyGoal(null, 5, now).completed, true);
  assert.equal(resolveQuranDailyGoal(row, 0, now).pagesTarget, 21);
  for (const pages of [1, 10, 20, 21, 25]) {
    const updated = { ...row, totalPagesRead: pages };
    const goal = resolveQuranDailyGoal(updated, pages, now);
    assert.equal(goal.pagesTarget, 21, 'Reading must not lower the target');
    assert.equal(goal.completed, pages >= 21);
    const plan = buildPlanDto({ row: updated, pagesReadToday: pages, now });
    assert.equal(plan.todayWard?.pagesTarget, goal.pagesTarget);
    assert.equal(plan.todayWard?.completed, goal.completed);
    assert.equal(plan.todayWard?.remainingToday, goal.remainingToday);
  }
  const finished = resolveQuranDailyGoal({ ...row, totalPagesRead: 604 }, 21, now);
  assert.equal(finished.pagesTarget, 0);
  assert.equal(finished.completed, true);
  assert.equal(finished.percent, 100);
  assert.equal(finished.remainingToday, 0);
  const overdue = resolveQuranDailyGoal({ ...row, totalPagesRead: 600, planTargetEndAt: now }, 0, now);
  assert.equal(overdue.pagesTarget, 4);
  assert.equal(overdue.daysRemaining, 1);
  const cleared = resolveQuranDailyGoal({ ...row, planMode: null }, 2, now);
  assert.equal(cleared.source, 'default');
  assert.equal(cleared.pagesTarget, 5);
  const boundary = { ...row, planTargetEndAt: new Date('2026-10-11T21:30:00Z') };
  const boundaryNow = new Date('2026-10-10T20:30:00Z');
  assert.equal(resolveQuranDailyGoal(boundary, 0, boundaryNow, 'Africa/Cairo').daysRemaining, 2);
  assert.equal(resolveQuranDailyGoal(boundary, 0, boundaryNow, 'America/Los_Angeles').daysRemaining, 1);

  // Exercise the production read-only service without touching a real database.
  const originalUser = prisma.user.findUnique;
  const originalPlan = prisma.khatmah.findUnique;
  try {
    prisma.user.findUnique = (async () => ({ timezone: 'Africa/Cairo' })) as typeof originalUser;
    prisma.khatmah.findUnique = (async () => ({ ...row, totalPagesRead: 10 })) as typeof originalPlan;
    assert.equal((await getDailyQuranGoal('test-user', 10, now)).pagesTarget, 21);
    prisma.khatmah.findUnique = (async () => null) as typeof originalPlan;
    assert.equal((await getDailyQuranGoal('test-user', 4, now)).pagesTarget, 5);
    prisma.khatmah.findUnique = (async () => { throw new Error('database unavailable'); }) as typeof originalPlan;
    await assert.rejects(getDailyQuranGoal('test-user', 4, now), /database unavailable/);
  } finally {
    prisma.user.findUnique = originalUser;
    prisma.khatmah.findUnique = originalPlan;
  }
  console.log('Quran daily goal: default, active, reading, completion, overdue, timezone and service checks passed');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
