import { buildAzanNotificationCopy, computeNearPrayerLocalHhmm } from '../src/services/prayer-reminder.service';
import '../src/load-env';
import { prisma } from '../src/lib/prisma';

async function main() {
  const tz = 'Africa/Cairo';
  const thu = new Date('2026-09-24T09:00:00.000Z');
  const fri = new Date('2026-09-25T09:00:00.000Z');
  const pre = buildAzanNotificationCopy({
    prayerNameOrKey: 'FAJR',
    time: '05:00',
    isPre: true,
    preReminderMinutes: 15,
    evaluationTimezone: tz,
    nowUtc: thu,
  });
  const azan = buildAzanNotificationCopy({
    prayerNameOrKey: 'FAJR',
    time: '05:00',
    isPre: false,
    preReminderMinutes: 15,
    evaluationTimezone: tz,
    nowUtc: thu,
  });
  const jum = buildAzanNotificationCopy({
    prayerNameOrKey: 'DHUHR',
    time: '12:00',
    isPre: false,
    preReminderMinutes: 15,
    evaluationTimezone: tz,
    nowUtc: fri,
  });
  console.log(
    JSON.stringify(
      {
        preTitle: pre.titleAr,
        preEvent: pre.eventType,
        azanTitle: azan.titleAr,
        azanEvent: azan.eventType,
        jumuahEvent: jum.eventType,
        jumuahKey: jum.eventKey,
        pre1045: computeNearPrayerLocalHhmm('05:00', 15),
        pre1050: computeNearPrayerLocalHhmm('05:00', 10),
      },
      null,
      2,
    ),
  );

  const rows = await prisma.$queryRawUnsafe<Array<{ column_default: string | null }>>(
    `SELECT column_default FROM information_schema.columns WHERE table_name='users' AND column_name='salawatAudioClipId'`,
  );
  console.log('salawat_default_now', rows[0]?.column_default);
  const mig = await prisma.$queryRawUnsafe<Array<{ migration_name: string }>>(
    `SELECT migration_name FROM _prisma_migrations WHERE migration_name='20260925073000_salawat_default_audio_clip'`,
  );
  console.log('migration_applied', mig.length === 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
