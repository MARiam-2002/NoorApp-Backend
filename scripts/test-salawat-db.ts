/**
 * Salawat persistence + cron de-dupe (requires DATABASE_URL + JWT secrets).
 * Run: npx tsx scripts/test-salawat-db.ts
 */
import '../src/load-env';
import { prisma } from '../src/lib/prisma';
import { AppError } from '../src/lib/errors';
import * as authService from '../src/services/auth.service';
import {
  getSalawatPreferences,
  updateSalawatPreferences,
  runSalawatReminders,
  getLocalClock,
  evaluateSalawatEligibility,
} from '../src/services/salawat-reminder.service';

let failed = 0;
function pass(name: string) {
  console.log(`PASS  ${name}`);
}
function fail(name: string, detail?: string) {
  failed += 1;
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
}

function findLocalHour(targetHour: number, timeZone: string): Date {
  const base = new Date();
  for (let i = 0; i < 48 * 6; i++) {
    const d = new Date(base.getTime() - i * 10 * 60_000);
    if (getLocalClock(d, timeZone).hour === targetHour) return d;
  }
  throw new Error(`Could not find local hour ${targetHour}`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('SKIP  DATABASE_URL not set');
    return;
  }

  const stamp = Date.now();
  const email = `salawat-qa-${stamp}@example.com`;
  const created = await authService.signUp({
    fullName: 'Salawat QA',
    email,
    password: 'SalawatTest123!',
  });
  const userId = created.user.id;
  const other = await authService.signUp({
    fullName: 'Salawat Other',
    email: `salawat-other-${stamp}@example.com`,
    password: 'SalawatTest123!',
  });

  try {
    const defaults = await getSalawatPreferences(userId);
    defaults.enabled === false ? pass('default enabled is false') : fail('default enabled is false', JSON.stringify(defaults));
    defaults.intervalMinutes === 180 ? pass('default intervalMinutes 180') : fail('default intervalMinutes', String(defaults.intervalMinutes));
    defaults.startTime === '08:00' && defaults.endTime === '22:00'
      ? pass('default window 08:00–22:00')
      : fail('default window', `${defaults.startTime}-${defaults.endTime}`);
    defaults.intervalHours === 3 ? pass('legacy intervalHours 3') : fail('intervalHours', String(defaults.intervalHours));
    defaults.quietHoursStart === '22:00' && defaults.quietHoursEnd === '08:00'
      ? pass('legacy quietHours mapped from window')
      : fail('quietHours', `${defaults.quietHoursStart}-${defaults.quietHoursEnd}`);

    const otherDefaults = await getSalawatPreferences(other.user.id);
    otherDefaults.enabled === false ? pass('other user isolated default') : fail('other user default');

    await updateSalawatPreferences(userId, { enabled: true });
    (await getSalawatPreferences(userId)).enabled === true ? pass('enable') : fail('enable');
    await updateSalawatPreferences(userId, { enabled: false });
    (await getSalawatPreferences(userId)).enabled === false ? pass('disable') : fail('disable');

    for (const n of [30, 60, 120, 180] as const) {
      const row = await updateSalawatPreferences(userId, { intervalMinutes: n });
      row.intervalMinutes === n ? pass(`interval ${n}`) : fail(`interval ${n}`, String(row.intervalMinutes));
    }

    const coerced = await updateSalawatPreferences(userId, { intervalMinutes: 15 as any });
    coerced.intervalMinutes === 180
      ? pass('service normalizes illegal interval instead of writing it')
      : fail('normalize illegal interval', String(coerced.intervalMinutes));

    try {
      await updateSalawatPreferences(userId, { startTime: '25:00' });
      fail('invalid startTime rejected');
    } catch (err) {
      err instanceof AppError && err.statusCode === 400
        ? pass('invalid startTime rejected')
        : fail('invalid startTime rejected', String(err));
    }

    const windowed = await updateSalawatPreferences(userId, {
      startTime: '09:00',
      endTime: '21:00',
    });
    windowed.startTime === '09:00' && windowed.endTime === '21:00'
      ? pass('valid start/end persisted')
      : fail('window persist', JSON.stringify(windowed));

    const reread = await getSalawatPreferences(userId);
    reread.startTime === '09:00' ? pass('preferences survive reread') : fail('reread');

    (await getSalawatPreferences(other.user.id)).startTime === '08:00'
      ? pass('cannot see other user window via own id')
      : fail('isolation');

    await updateSalawatPreferences(userId, {
      enabled: true,
      intervalMinutes: 60,
      startTime: '08:00',
      endTime: '22:00',
    });
    await prisma.deviceToken.create({
      data: { userId, token: `salawat-fake-${stamp}-abcdefghij`, platform: 'android' },
    });

    const tz = 'Africa/Cairo';
    await prisma.user.update({ where: { id: userId }, data: { timezone: tz } });
    const now = findLocalHour(14, tz);
    const decision = evaluateSalawatEligibility({
      enabled: true,
      now,
      timeZone: tz,
      recentSentAt: [],
      intervalMinutes: 60,
      startTime: '08:00',
      endTime: '22:00',
    });
    decision.eligible ? pass('enabled inside window eligible') : fail('eligible', decision.reason);

    const first = await runSalawatReminders(now);
    first.pushesAttempted >= 1 || first.skipped.DUPLICATE
      ? pass(`first cron scanned=${first.usersScanned} attempted=${first.pushesAttempted}`)
      : fail('first cron attempted', JSON.stringify(first));

    const second = await runSalawatReminders(now);
    const logs = await prisma.salawatSendLog.count({ where: { userId } });
    logs === 1 ? pass('duplicate cron does not insert second send log') : fail('send log count', String(logs));
    second.skipped.DUPLICATE || second.pushesAttempted === 0
      ? pass('second cron skipped as duplicate or no attempt')
      : fail('second cron', JSON.stringify(second));

    const notes = await prisma.notification.count({ where: { userId, type: 'SALAWAT' as any } });
    notes <= 1 ? pass('at most one SALAWAT in-app row for the slot') : fail('notification dupes', String(notes));

    await authService.deleteAccount(userId);
    const goneLogs = await prisma.salawatSendLog.count({ where: { userId } });
    goneLogs === 0 ? pass('account delete cascades salawat send logs') : fail('cascade logs', String(goneLogs));
    const goneUser = await prisma.user.findUnique({ where: { id: userId } });
    goneUser ? fail('user deleted') : pass('user deleted with salawat prefs');
  } finally {
    await prisma.salawatSendLog.deleteMany({ where: { userId: other.user.id } }).catch(() => null);
    await prisma.user.delete({ where: { id: other.user.id } }).catch(() => null);
    await prisma.deletedIdentity.deleteMany({
      where: { email: { in: [email, `salawat-other-${stamp}@example.com`] } },
    }).catch(() => null);
  }
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
