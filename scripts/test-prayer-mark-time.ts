/**
 * PATCH /prayers/:id/mark — a prayer can be marked done only once its time has started in the user's location;
 * Isha between midnight and Fajr goes to the night that just passed; unmarking is always allowed.
 * Cairo, 2026-11-14 (EGYPTIAN): Fajr 02:50Z, Dhuhr 09:40Z, Maghrib 14:59Z, Isha 16:20Z.
 *
 *   PRAYER_MARK_TEST_DB=true npx tsx scripts/test-prayer-mark-time.ts
 */
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { markPrayer } from '../src/services/prayer.service';

if (process.env.PRAYER_MARK_TEST_DB !== 'true') {
  console.log('SKIP prayer mark time test (set PRAYER_MARK_TEST_DB=true with a test database)');
  process.exit(0);
}

const at = (iso: string) => new Date(iso);

async function main() {
  const stamp = Date.now();
  const user = await prisma.user.create({
    data: {
      email: `mark-time-${stamp}@noor-test.local`, username: `mark_time_${stamp}`, fullName: 'Mark Time',
      latitude: 30.0444, longitude: 31.2357, timezone: 'Africa/Cairo', city: 'Cairo', country: 'Egypt',
    },
  });
  const done = async (prayer: string, day: string) =>
    Boolean(await prisma.prayerCompletion.findFirst({ where: { userId: user.id, prayer: prayer as never, date: new Date(`${day}T00:00:00.000Z`) } }));
  try {
    // 10:00 Cairo: Dhuhr (11:40) has not started.
    await assert.rejects(markPrayer(user.id, 'DHUHR', at('2026-11-14T08:00:00Z')), (e: any) =>
      e.statusCode === 409 && e.details?.reason === 'PRAYER_NOT_YET_DUE' && e.details?.prayer === 'DHUHR' &&
      Math.abs(new Date(e.details.startsAt).getTime() - at('2026-11-14T09:40:00Z').getTime()) <= 60_000);
    assert.equal(await done('DHUHR', '2026-11-14'), false);

    // Fajr has started: mark, then unmark.
    const fajr = await markPrayer(user.id, 'FAJR', at('2026-11-14T08:00:00Z'));
    assert.deepEqual([fajr.completed, fajr.date, fajr.forPreviousNight], [true, '2026-11-14', false]);
    assert.equal((await markPrayer(user.id, 'FAJR', at('2026-11-14T08:01:00Z'))).completed, false);

    // A minute of clock skew is accepted right at the start.
    assert.equal((await markPrayer(user.id, 'DHUHR', at('2026-11-14T09:39:30Z'))).completed, true);

    // 01:30 Cairo on the 14th: Isha belongs to the night of the 13th; Maghrib of the 14th has not started.
    const isha = await markPrayer(user.id, 'ISHA', at('2026-11-13T23:30:00Z'));
    assert.deepEqual([isha.completed, isha.date, isha.forPreviousNight], [true, '2026-11-13', true]);
    assert.equal(await done('ISHA', '2026-11-13'), true);
    assert.equal(await done('ISHA', '2026-11-14'), false);
    await assert.rejects(markPrayer(user.id, 'MAGHRIB', at('2026-11-13T23:30:00Z')), (e: any) => e.statusCode === 409);
    // Tapping again before Fajr unmarks last night's Isha.
    assert.equal((await markPrayer(user.id, 'ISHA', at('2026-11-13T23:40:00Z'))).completed, false);
    assert.equal(await done('ISHA', '2026-11-13'), false);

    // After Isha starts on the 14th it is today's Isha.
    const ishaToday = await markPrayer(user.id, 'ISHA', at('2026-11-14T17:00:00Z'));
    assert.deepEqual([ishaToday.completed, ishaToday.date, ishaToday.forPreviousNight], [true, '2026-11-14', false]);
    console.log('prayer mark time tests: ALL PASSED (not before its time, Isha after midnight, unmark, clock skew)');
  } finally {
    await prisma.prayerCompletion.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
