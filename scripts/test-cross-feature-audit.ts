import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { getTodayTasbih, incrementTasbih, resetTasbih, changeDhikr } from '../src/services/tasbih.service';
import { getWeeklyStats, getMonthlyStats, getWeeklyCategorySummary, getJourneyProgress, getMonthlyCalendarHeatmap } from '../src/services/journey.service';
import { getHadithOfTheDayLite } from '../src/services/daily-content.service';
import { getCuratedHadithForDay } from '../src/shared/constants/fallbacks';
import { localMidnight } from '../src/services/reading-plan.service';

async function main() {
  const RealDate = Date;
  let now = '2026-10-23T22:30:00Z';
  class AuditDate extends RealDate {
    constructor(value?: any) { super(value === undefined ? now : value); }
    static now() { return new RealDate(now).getTime(); }
  }
  const original = { user: prisma.user.findUnique, upsert: prisma.tasbihLog.upsert,
    update: prisma.tasbihLog.update, aggregate: prisma.tasbihLog.aggregate,
    progress: prisma.dailyProgress.findMany, progressOne: prisma.dailyProgress.findUnique, prayers: prisma.prayerCompletion.findMany,
    challenges: prisma.challengeCompletion.findMany, khatmah: prisma.khatmah.findUnique };
  let timezone = 'Africa/Cairo';
  const rows = new Map<string, any>();
  rows.set('2026-10-23', { id: 'past', date: new RealDate('2026-10-23'), dhikr: 'SUBHAN_ALLAH', count: 80, totalAllTime: 100 });
  try {
    globalThis.Date = AuditDate as DateConstructor;
    prisma.user.findUnique = (async () => ({ timezone })) as any;
    prisma.tasbihLog.upsert = (async ({ where, create }: any) => {
      assert.equal(where.userId_date.userId, 'audit');
      const key = where.userId_date.date.toISOString().slice(0, 10);
      if (!rows.has(key)) rows.set(key, { id: key, date: where.userId_date.date, dhikr: create.dhikr ?? 'SUBHAN_ALLAH', count: 0, totalAllTime: 0 });
      return rows.get(key);
    }) as any;
    prisma.tasbihLog.update = (async ({ where, data }: any) => {
      const row = [...rows.values()].find(r => r.id === where.id);
      row.count = typeof data.count === 'number' ? data.count : row.count + (data.count?.increment ?? 0);
      row.totalAllTime += data.totalAllTime?.increment ?? 0;
      return row;
    }) as any;
    prisma.tasbihLog.aggregate = (async ({where}: any) => {
      assert.equal(where.userId, 'audit');
      return { _sum: { totalAllTime: [...rows.values()].reduce((sum, r) => sum + r.totalAllTime, 0) } };
    }) as any;
    const cairo = await getTodayTasbih('audit');
    assert.equal(cairo.date!.toISOString().slice(0, 10), '2026-10-24');
    assert.equal(cairo.count, 0);
    assert.equal(cairo.totalAllTime, 100, 'new day must not erase lifetime total');
    assert.equal((await incrementTasbih('audit', 5)).totalAllTime, 105);
    const reset = await resetTasbih('audit');
    assert.equal(reset.count, 0);
    assert.equal(reset.totalAllTime, 105, 'reset only resets today count');
    await changeDhikr('audit', 'ALLAHU_AKBAR');
    timezone = 'America/Los_Angeles';
    assert.equal((await getTodayTasbih('audit')).date!.toISOString().slice(0, 10), '2026-10-23');
    timezone = 'Asia/Riyadh';
    assert.equal((await getTodayTasbih('audit')).date!.toISOString().slice(0, 10), '2026-10-24');

    now = '2026-12-31T22:30:00Z'; timezone = 'Africa/Cairo';
    let progressQuery: any, challengeQuery: any;
    prisma.dailyProgress.findMany = (async (query: any) => { progressQuery = query; return [{ date: new RealDate('2027-01-01'), quranPagesRead: 10, morningAdhkarCompleted: true, eveningAdhkarCompleted: false, adhkarCompleted: false, sadaqahAmount: 0 }]; }) as any;
    prisma.prayerCompletion.findMany = (async () => []) as any;
    prisma.challengeCompletion.findMany = (async (query: any) => { challengeQuery = query; return []; }) as any;
    prisma.khatmah.findUnique = (async () => null) as any;
    const weekly = await getWeeklyStats('audit');
    assert.equal(weekly.period.from, '2026-12-26');
    assert.equal(weekly.period.to, '2027-01-01');
    assert.equal(weekly.period.days, 7);
    const monthly = await getMonthlyStats('audit');
    assert.deepEqual(monthly.month, { month: 1, year: 2027 });
    assert.equal(progressQuery.where.date.gte.toISOString(), '2027-01-01T00:00:00.000Z');
    assert.equal(progressQuery.where.date.lte.toISOString(), '2027-01-31T00:00:00.000Z');
    assert.equal(challengeQuery.where.claimedAt.gte.toISOString(), localMidnight('2027-01-01', timezone).toISOString());
    assert.equal(challengeQuery.where.claimedAt.lt.toISOString(), localMidnight('2027-02-01', timezone).toISOString());
    const summary = await getWeeklyCategorySummary('audit');
    assert.equal(summary.quranGoal.pagesTarget, 5);
    assert.equal(summary.categories.find(c => c.key === 'QURAN')!.percent, 29, '10 / (7*5), not hardcoded four-page goal');
    assert.equal(summary.categories.find(c => c.key === 'ADHKAR')!.percent, 7);
    const progress = await getJourneyProgress('audit');
    assert.equal(progress.quranGoal.pagesTarget, 5);
    prisma.khatmah.findUnique = (async () => ({ planMode: 'DURATION', planStartedAt: new RealDate('2027-01-01'), planPagesAtStart: 0, planTargetEndAt: localMidnight('2027-01-31', timezone), planDurationDays: 30, totalPagesRead: 10 })) as any;
    assert.equal((await getWeeklyCategorySummary('audit')).quranGoal.pagesTarget, 21, 'use reconstructed start-of-day plan target');
    assert.deepEqual(await getHadithOfTheDayLite(1, 2027), getCuratedHadithForDay(1, 2027));
    prisma.khatmah.findUnique = (async () => null) as any;
    prisma.dailyProgress.findMany = (async () => []) as any;
    prisma.dailyProgress.findUnique = (async () => null) as any;
    prisma.prayerCompletion.findMany = (async () => [{ date: new RealDate('2027-01-01'), prayer: 'FAJR' }]) as any;
    const prayerOnly = await getJourneyProgress('audit');
    assert.equal(prayerOnly.daily.length, 1);
    assert.equal(prayerOnly.daily[0].prayersCompleted, 1);
    assert.ok(prayerOnly.daily[0].overallPercent > 0);
    const calendar = await getMonthlyCalendarHeatmap('audit', 1, 2027);
    assert.equal(calendar.quranGoal.pagesTarget, 5);
    assert.equal(calendar.cells[0].status, 'partial', 'prayer-only day must not be marked missed');
    console.log('Cross-feature audit regression passed: local tasbih days/lifetime, exact seven-day window, local monthly challenge bounds, dynamic Quran targets and explicit content year. Mock DB; no production writes.');
  } finally {
    globalThis.Date = RealDate;
    prisma.user.findUnique = original.user; prisma.tasbihLog.upsert = original.upsert;
    prisma.tasbihLog.update = original.update; prisma.tasbihLog.aggregate = original.aggregate;
    prisma.dailyProgress.findMany = original.progress; prisma.dailyProgress.findUnique = original.progressOne; prisma.prayerCompletion.findMany = original.prayers;
    prisma.challengeCompletion.findMany = original.challenges; prisma.khatmah.findUnique = original.khatmah;
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
