/**
 * Fewer, calmer notifications and the tasbih summary:
 *  - one quiet window for every reminder except the Adhan (GET/PATCH /profile/notification-quiet-hours)
 *  - a repeated reminder folds into the unread one of the same kind (repeatCount) instead of a new row
 *  - old notifications are pruned (read > 30 days, any > 90 days)
 *  - GET /tasbih/summary: totals, average, best day, streak, per dhikr, zero-filled days
 *  - the Madani reader page falls back to the seeded text when the content provider fails
 *
 *   NOTIFY_TEST_DB=true npx tsx scripts/test-notification-comfort.ts
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  isQuietHoursExempt, isWithinQuietHours, normalizeQuietHours, quietHoursPatchSchema,
} from '../src/services/notification-quiet-hours.service';
import { isCollapsibleNotification, notificationGroupKey } from '../src/services/notification.service';

// --- Pure rules (always run) ---
{
  const on = { enabled: true, start: '23:00', end: '05:00' };
  const cairo = 'Africa/Cairo';
  // 2026-11-25 is winter time in Cairo (UTC+2).
  assert.equal(isWithinQuietHours(on, new Date('2026-11-25T21:30:00Z'), cairo), true, '23:30 Cairo is quiet');
  assert.equal(isWithinQuietHours(on, new Date('2026-11-25T01:00:00Z'), cairo), true, '03:00 Cairo is quiet');
  assert.equal(isWithinQuietHours(on, new Date('2026-11-25T03:00:00Z'), cairo), false, '05:00 Cairo is not (end is exclusive)');
  assert.equal(isWithinQuietHours(on, new Date('2026-11-25T10:00:00Z'), cairo), false, 'midday is not quiet');
  assert.equal(isWithinQuietHours({ ...on, enabled: false }, new Date('2026-11-25T21:30:00Z'), cairo), false, 'off means never quiet');
  assert.equal(isWithinQuietHours({ enabled: true, start: '13:00', end: '15:00' }, new Date('2026-11-25T12:00:00Z'), cairo), true, 'same-day window');
  assert.equal(isWithinQuietHours({ enabled: true, start: '08:00', end: '08:00' }, new Date('2026-11-25T06:00:00Z'), cairo), false, 'empty window');
  assert.equal(isWithinQuietHours(on, new Date('2026-11-25T21:30:00Z'), 'Not/AZone'), true, 'unknown zone falls back to Cairo');

  assert.deepEqual(normalizeQuietHours(null), { enabled: false, start: '23:00', end: '05:00' });
  assert.deepEqual(normalizeQuietHours({ enabled: true, start: '25:00', end: '06:30' }), { enabled: true, start: '23:00', end: '06:30' });
  assert.ok(quietHoursPatchSchema.safeParse({ enabled: true }).success);
  assert.equal(quietHoursPatchSchema.safeParse({}).success, false, 'empty patch');
  assert.equal(quietHoursPatchSchema.safeParse({ start: '7:00' }).success, false, 'HH:mm only');
  assert.equal(quietHoursPatchSchema.safeParse({ start: '07:00', extra: 1 }).success, false, 'strict body');

  assert.equal(isQuietHoursExempt({ type: 'AZAN' }), true, 'the Adhan always goes through');
  assert.equal(isQuietHoursExempt({ type: 'TEST' }), true, 'a test push always goes through');
  assert.equal(isQuietHoursExempt({ type: 'SALAWAT' }), false);
  assert.equal(isQuietHoursExempt(undefined), false);

  assert.equal(isCollapsibleNotification('SALAWAT', { type: 'SALAWAT' }), true);
  assert.equal(isCollapsibleNotification('AZAN', { type: 'AZAN' }), false, 'each Adhan stays its own row');
  assert.equal(isCollapsibleNotification('PRAYER_REMINDER', null), false);
  assert.equal(isCollapsibleNotification('CHALLENGE', null), false);
  assert.equal(isCollapsibleNotification('GENERAL', { type: 'CHARITY_REMINDER', collapse: false }), false, 'opt-out per notification');
  assert.notEqual(notificationGroupKey('GENERAL', { type: 'CHARITY_REMINDER' }), notificationGroupKey('GENERAL', { type: 'KAHF' }), 'different reminder kinds stay apart');
  console.log('notification comfort pure rules: PASSED');
}

if (process.env.NOTIFY_TEST_DB !== 'true') {
  console.log('SKIP notification comfort DB checks (set NOTIFY_TEST_DB=true with a test database)');
  process.exit(0);
}

async function main() {
  const { prisma } = await import('../src/lib/prisma');
  const { getQuietHours, updateQuietHours, userIsInQuietHours } = await import('../src/services/notification-quiet-hours.service');
  const { createNotification, listNotifications, pruneOldNotifications, markAllAsRead } = await import('../src/services/notification.service');
  const { sendPushToUser } = await import('../src/services/device.service');
  const { getTasbihSummary } = await import('../src/services/tasbih.service');

  const id = randomUUID();
  const stamp = Date.now();
  await prisma.$executeRaw`INSERT INTO "users" ("id","username","email","updatedAt","timezone") VALUES (${id}, ${`comfort_${stamp}`}, ${`comfort-${stamp}@noor-test.local`}, CURRENT_TIMESTAMP, 'Africa/Cairo')`;
  try {
    // Quiet hours: default off, PATCH keeps the fields not sent, push held back inside the window.
    assert.deepEqual(await getQuietHours(id), { enabled: false, start: '23:00', end: '05:00', timezone: 'Africa/Cairo' });
    const saved = await updateQuietHours(id, { enabled: true, start: '00:00', end: '23:59' });
    assert.deepEqual(saved, { enabled: true, start: '00:00', end: '23:59', timezone: 'Africa/Cairo' });
    assert.equal((await updateQuietHours(id, { end: '23:58' })).start, '00:00', 'partial patch keeps start');
    assert.throws(() => quietHoursPatchSchema.parse({ start: 'x' }));
    await assert.rejects(updateQuietHours(id, { start: 'x' }));
    const inside = new Date('2026-11-25T10:00:00Z');
    assert.equal(await userIsInQuietHours(id, inside), true);
    const held = await sendPushToUser(id, { title: 't', body: 'b', data: { type: 'SALAWAT' } });
    // The window is 00:00–23:58 Cairo; only the last two minutes of the day fall outside it.
    const utcMin = new Date().getUTCHours() * 60 + new Date().getUTCMinutes();
    if (!(utcMin >= 21 * 60 + 58 && utcMin < 22 * 60)) assert.equal((held as any).reason, 'QUIET_HOURS', 'reminder held back');
    const adhan = await sendPushToUser(id, { title: 't', body: 'b', data: { type: 'AZAN' } });
    assert.notEqual((adhan as any).reason, 'QUIET_HOURS', 'the Adhan is never held back');
    await updateQuietHours(id, { enabled: false });
    assert.equal(await userIsInQuietHours(id, inside), false);

    // Collapse: three salawat reminders → one unread row with repeatCount 3; an Adhan stays separate.
    const salawat = { userId: id, titleAr: 'صلِّ على النبي', titleEn: 'Salawat', bodyAr: 'ب', bodyEn: 'b', type: 'SALAWAT' as const, payload: { type: 'SALAWAT' } };
    await createNotification(salawat);
    await createNotification(salawat);
    const third = await createNotification({ ...salawat, bodyAr: 'آخر' });
    assert.equal(third.repeatCount, 3);
    assert.equal(third.bodyAr, 'آخر', 'latest text wins');
    await createNotification({ userId: id, titleAr: 'الظهر', titleEn: 'Dhuhr', bodyAr: 'ب', bodyEn: 'b', type: 'AZAN', payload: { type: 'AZAN' } });
    await createNotification({ userId: id, titleAr: 'العصر', titleEn: 'Asr', bodyAr: 'ب', bodyEn: 'b', type: 'AZAN', payload: { type: 'AZAN' } });
    let list = await listNotifications(id, 1, 20);
    assert.equal(list.data.length, 3, 'one salawat row + two Adhan rows');
    assert.equal(list.meta.unreadCount, 3);
    // Once read, the next reminder starts a new row.
    await markAllAsRead(id);
    const fresh = await createNotification(salawat);
    assert.equal(fresh.repeatCount, 1);
    list = await listNotifications(id, 1, 20);
    assert.equal(list.data.length, 4);

    // Retention: read rows older than 30 days and any row older than 90 days are pruned.
    const day = 86_400_000;
    await prisma.notification.createMany({ data: [
      { userId: id, titleAr: 'قديم مقروء', titleEn: 'old read', bodyAr: 'b', bodyEn: 'b', type: 'SYSTEM', readAt: new Date(), createdAt: new Date(Date.now() - 40 * day) },
      { userId: id, titleAr: 'قديم غير مقروء', titleEn: 'old unread', bodyAr: 'b', bodyEn: 'b', type: 'SYSTEM', createdAt: new Date(Date.now() - 40 * day) },
      { userId: id, titleAr: 'قديم جداً', titleEn: 'very old', bodyAr: 'b', bodyEn: 'b', type: 'SYSTEM', createdAt: new Date(Date.now() - 100 * day) },
    ] as any });
    const pruned = await pruneOldNotifications();
    assert.ok(pruned.deleted >= 2);
    const titles = (await prisma.notification.findMany({ where: { userId: id }, select: { titleAr: true } })).map(r => r.titleAr);
    assert.ok(titles.includes('قديم غير مقروء'), 'unread under 90 days is kept');
    assert.ok(!titles.includes('قديم مقروء') && !titles.includes('قديم جداً'));

    // Tasbih summary: 7 days ending today (Cairo), zero-filled, streak from today back.
    const now = new Date('2026-11-25T10:00:00Z');
    const d = (k: string) => new Date(`${k}T00:00:00Z`);
    await prisma.tasbihLog.createMany({ data: [
      { userId: id, date: d('2026-11-25'), dhikr: 'SUBHAN_ALLAH', count: 10, totalAllTime: 40 },
      { userId: id, date: d('2026-11-24'), dhikr: 'ALHAMDULILLAH', count: 0, totalAllTime: 120 },
      { userId: id, date: d('2026-11-23'), dhikr: 'SUBHAN_ALLAH', count: 33, totalAllTime: 33 },
      { userId: id, date: d('2026-11-20'), dhikr: 'ALLAHU_AKBAR', count: 7, totalAllTime: 7 },
      { userId: id, date: d('2026-10-01'), dhikr: 'ALLAHU_AKBAR', count: 1000, totalAllTime: 1000 },
    ] as any });
    const week = await getTasbihSummary(id, 7, now);
    assert.equal(week.from, '2026-11-19');
    assert.equal(week.to, '2026-11-25');
    assert.equal(week.perDay.length, 7);
    assert.equal(week.perDay[0]!.count, 0, 'missing day is zero');
    assert.equal(week.total, 200, 'reset does not erase what was said (uses totalAllTime)');
    assert.equal(week.activeDays, 4);
    assert.equal(week.avgPerDay, Math.round(200 / 7));
    assert.equal(week.avgPerActiveDay, 50);
    assert.deepEqual(week.bestDay, { date: '2026-11-24', count: 120 });
    assert.equal(week.currentStreakDays, 3);
    assert.equal(week.goalMetDays, [40, 120, 33, 7].filter(c => c >= week.dailyGoal).length);
    assert.equal(week.lifetimeTotal, 1200);
    assert.deepEqual(week.perDhikr.map(p => [p.dhikr, p.total]), [['ALHAMDULILLAH', 120], ['SUBHAN_ALLAH', 73], ['ALLAHU_AKBAR', 7]]);
    assert.ok(week.perDhikr.every(p => p.dhikrAr.length > 0));
    // Nothing said yet today → the streak still counts up to yesterday.
    await prisma.tasbihLog.deleteMany({ where: { userId: id, date: d('2026-11-25') } });
    assert.equal((await getTasbihSummary(id, 7, now)).currentStreakDays, 2);
    assert.equal((await getTasbihSummary(id, 60, now)).total, 1160);
    await assert.rejects(getTasbihSummary(id, 0, now), (e: any) => e.statusCode === 400);
    await assert.rejects(getTasbihSummary(id, 400, now), (e: any) => e.statusCode === 400);

    // Reader fallback: the seeded Madani text answers a page when the provider is unavailable.
    const { localMadaniPage } = await import('../src/services/mushaf.service');
    const p1 = await localMadaniPage(1);
    if (p1) {
      assert.equal(p1[0]!.key, '1:1');
      assert.equal(p1.length, 7, 'Al-Fatiha fills page 1');
      assert.ok(p1.every(v => v.text.length > 0));
    } else {
      console.log('note: Quran text not seeded in this database; fallback shape not checked');
    }
    assert.equal(await localMadaniPage(9999), null);

    console.log('notification comfort DB checks: ALL PASSED (quiet hours, collapse, retention, tasbih summary)');
  } finally {
    await prisma.notification.deleteMany({ where: { userId: id } });
    await prisma.tasbihLog.deleteMany({ where: { userId: id } });
    await prisma.user.delete({ where: { id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
