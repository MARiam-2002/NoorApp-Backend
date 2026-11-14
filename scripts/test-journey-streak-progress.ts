/**
 * Journey numbers the app shows as-is:
 * - GET /journey/progress returns every day of the window (no gaps), and ?days is bounded.
 * - «سلسلة الحسنات» counts deeds (Quran, adhkar, a marked prayer), never an empty day; it stays alive until today ends.
 * - The daily challenge reports progress in its own unit (PRAYER counts prayers, not pages).
 *
 *   JOURNEY_TEST_DB=true npx tsx scripts/test-journey-streak-progress.ts
 */
import assert from 'node:assert/strict';
import { dailyChallengeProgress } from '../src/utils/challenge';
import { streakFromActiveDays } from '../src/services/journey.service';

const snap = (pages = 0, adhkar = false) => ({ quranPagesRead: pages, adhkarCompleted: adhkar, sadaqahAmount: 0 });

// --- Pure rules (always run) ---
{
  const p = dailyChallengeProgress('PRAYER', 5, snap(4), ['FAJR', 'DHUHR'] as never);
  assert.deepEqual([p.current, p.target, p.unit, p.unitAr, p.percent, p.completed], [2, 5, 'PRAYERS', 'صلوات', 40, false]);
  const q = dailyChallengeProgress('QURAN_PAGES', 2, snap(7));
  assert.deepEqual([q.current, q.target, q.unit, q.percent, q.completed], [2, 2, 'PAGES', 100, true]);
  const a = dailyChallengeProgress('ADHKAR', 1, snap(0, true));
  assert.deepEqual([a.current, a.target, a.unit, a.completed], [1, 1, 'WIRD', true]);
  const s = dailyChallengeProgress('SADAQAH', 10, snap());
  assert.deepEqual([s.current, s.unit, s.completed], [0, 'NONE', false]);

  const today = new Date('2026-11-14T00:00:00.000Z');
  assert.deepEqual(streakFromActiveDays(new Set(['2026-11-14', '2026-11-13', '2026-11-11']), today),
    { days: 2, todayActive: true, endDate: '2026-11-14' });
  // Nothing yet today: yesterday's run still counts until the day ends.
  assert.deepEqual(streakFromActiveDays(new Set(['2026-11-13', '2026-11-12']), today),
    { days: 2, todayActive: false, endDate: '2026-11-13' });
  assert.deepEqual(streakFromActiveDays(new Set(['2026-11-12']), today), { days: 0, todayActive: false, endDate: null });
  console.log('journey pure rules: PASSED');
}

if (process.env.JOURNEY_TEST_DB !== 'true') {
  console.log('SKIP journey DB checks (set JOURNEY_TEST_DB=true with a test database)');
  process.exit(0);
}

async function main() {
  const { prisma } = await import('../src/lib/prisma');
  const { getJourneyProgress, getActiveDayKeys } = await import('../src/services/journey.service');
  const { getUserLocalCalendarDay } = await import('../src/shared/utils/user-local-date');
  const stamp = Date.now();
  const user = await prisma.user.create({
    data: {
      email: `journey-${stamp}@noor-test.local`, username: `journey_${stamp}`, fullName: 'Journey Test',
      latitude: 30.0444, longitude: 31.2357, timezone: 'Africa/Cairo', city: 'Cairo', country: 'Egypt',
    },
  });
  try {
    const { date: today } = await getUserLocalCalendarDay(user.id);
    const ago = (n: number) => { const d = new Date(today); d.setUTCDate(d.getUTCDate() - n); return d; };
    const key = (d: Date) => d.toISOString().slice(0, 10);

    // 3 days ago: Quran. 2 days ago: a prayer only. Yesterday: opened the app (empty row). Today: nothing.
    await prisma.dailyProgress.create({ data: { userId: user.id, date: ago(3), quranPagesRead: 2 } });
    await prisma.prayerCompletion.create({ data: { userId: user.id, date: ago(2), prayer: 'FAJR' } });
    await prisma.dailyProgress.create({ data: { userId: user.id, date: ago(1) } });

    const active = await getActiveDayKeys(user.id, ago(30), today);
    assert.deepEqual([...active].sort(), [key(ago(3)), key(ago(2))]);

    const week = await getJourneyProgress(user.id, 7);
    assert.equal(week.daily.length, 7, 'every day of the window');
    assert.deepEqual(week.daily.map(d => d.date), [6, 5, 4, 3, 2, 1, 0].map(n => key(ago(n))));
    assert.equal(week.daily.find(d => d.date === key(ago(3)))!.quranPages, 2);
    assert.equal(week.daily.find(d => d.date === key(ago(2)))!.prayersCompleted, 1);
    assert.equal(week.daily.find(d => d.date === key(ago(5)))!.overallPercent, 0);
    assert.equal(week.summary.daysStreak, 0, 'an empty day breaks the streak');

    // A prayer yesterday joins the run: yesterday + 2 days ago + 3 days ago.
    await prisma.prayerCompletion.create({ data: { userId: user.id, date: ago(1), prayer: 'ISHA' } });
    assert.equal((await getJourneyProgress(user.id, 7)).summary.daysStreak, 3);

    // ?days is bounded and defaults to 7.
    assert.equal((await getJourneyProgress(user.id, Number('abc'))).daily.length, 7);
    assert.equal((await getJourneyProgress(user.id, 1e9)).daily.length, 90);
    assert.equal((await getJourneyProgress(user.id, 1)).daily.length, 1);
    console.log('journey DB checks: ALL PASSED (no gaps, streak counts deeds only, bounded days)');
  } finally {
    await prisma.prayerCompletion.deleteMany({ where: { userId: user.id } });
    await prisma.dailyProgress.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
