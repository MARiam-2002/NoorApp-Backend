/**
 * Offline regression (mocked DB, no push, no network) for the Nov 2026 prayer sound flow:
 *  1. prayerTimeSoundMode `announcement_azan` (default): Android keeps the Azan channel, iOS gets the
 *     combined clip only on devices that declared it.
 *  2. Pre-prayer default = spoken "the prayer is near" (sc_near_auto); saved choices never change.
 *  3. Duha/Qiyam FCM backup uses the coverage the app reports for that kind; old builds keep the
 *     legacy Azan coverage rule.
 *
 * Run: npx tsx scripts/test-prayer-sound-flow.ts
 */
import assert from 'node:assert/strict';
import { buildFcmMulticastMessage } from '../src/lib/fcm';
import { prisma } from '../src/lib/prisma';
import { runAzanRemindersForUser } from '../src/services/prayer-reminder.service';
import {
  azanPreferencesSchema,
  buildAzanPreferencesFromUser,
  defaultAzanPreferences,
  pickExplicitAzanPatch,
  DEFAULT_PRAYER_TIME_SOUND_MODE,
} from '../src/services/azan.service';
import { resolveAnnouncementAzanDeviceAudio } from '../src/services/device.service';
import {
  buildNotificationChannelManifest,
  announceAzanIosSoundId,
} from '../src/shared/utils/notification-channel-manifest';
import { DEFAULT_NOTIFICATION_SOUND_ID, AZAN_SOUND_OPTIONS } from '../src/shared/constants/azan-sounds';
import {
  extraPrayerCoverageInstant,
  nextExtraPrayerCoverage,
  readExtraPrayerCoverage,
} from '../src/services/extra-prayer-reminder.service';
import { extraPrayerPreferencesPatchSchema } from '../src/controllers/extra-prayer.controller';

async function main() {
  // ---- 1. Defaults -------------------------------------------------------------------------
  const defaults = defaultAzanPreferences();
  assert.equal(DEFAULT_PRAYER_TIME_SOUND_MODE, 'announcement_azan');
  assert.equal(defaults.prayerTimeSoundMode, 'announcement_azan');
  assert.equal(DEFAULT_NOTIFICATION_SOUND_ID, 'sc_near_auto');
  assert.equal(defaults.notificationSoundId, 'sc_near_auto');
  // Saved choices are kept exactly.
  const saved = buildAzanPreferencesFromUser({
    id: 'u', timezone: 'Africa/Cairo', latitude: 30.0444, longitude: 31.2357, city: 'Cairo',
    prayerCalculationMethod: 'EGYPT',
    azanPreferences: { notificationSoundId: 'soft_chime', prayerTimeSoundMode: 'azan' },
  } as any);
  assert.equal(saved.notificationSoundId, 'soft_chime');
  assert.equal(saved.prayerTimeSoundMode, 'azan');
  assert.deepEqual(pickExplicitAzanPatch({ prayerTimeSoundMode: 'announcement_azan' }), { prayerTimeSoundMode: 'announcement_azan' });
  assert.ok(azanPreferencesSchema.safeParse({ prayerTimeSoundOverrides: { fajr: 'announcement_azan' } }).success);
  assert.equal(azanPreferencesSchema.safeParse({ prayerTimeSoundMode: 'announcement+azan' }).success, false);

  // ---- 2. Manifest: iOS combined clips -------------------------------------------------------
  const manifest = buildNotificationChannelManifest();
  assert.equal(manifest.iosAnnouncementAzanSounds.length, 6 * AZAN_SOUND_OPTIONS.length);
  for (const id of manifest.iosAnnouncementAzanSounds) assert.match(id, /^[a-z0-9_]{1,64}$/);
  assert.ok(manifest.iosAnnouncementAzanSounds.includes('announce_azan_jumuah_nasser_al_qatami'));
  // Android never needs them: not in requiredBundledSounds, no channel uses them.
  for (const id of manifest.iosAnnouncementAzanSounds) {
    assert.ok(!manifest.requiredBundledSounds.includes(id));
    assert.ok(!manifest.channels.some((c) => c.nativeSound === id));
  }

  // ---- 3. Per-device audio ------------------------------------------------------------------
  const combined = announceAzanIosSoundId('fajr', 'nasser_al_qatami');
  const base = {
    data: { audioScope: 'prayer_time_announcement_azan', iosCombinedSound: combined },
    nativeSound: 'nasser_al_qatami',
    androidChannelId: 'azan_nasser_al_qatami',
  };
  const ios = resolveAnnouncementAzanDeviceAudio({ bundledSounds: [combined] }, base);
  assert.equal(ios.nativeSound, combined);
  assert.equal(ios.androidChannelId, 'azan_nasser_al_qatami');
  const iosWire = buildFcmMulticastMessage(['t'], { title: 't', body: 'b', data: ios.data, nativeSound: ios.nativeSound, androidChannelId: ios.androidChannelId });
  assert.equal(iosWire.apns.payload.aps.sound, `${combined}.caf`);
  const android = resolveAnnouncementAzanDeviceAudio({ bundledSounds: ['nasser_al_qatami', 'sc_event_fajr'] }, base);
  assert.equal(android.nativeSound, 'nasser_al_qatami');
  assert.equal(resolveAnnouncementAzanDeviceAudio(null, base).nativeSound, 'nasser_al_qatami', 'old builds keep the Azan');
  assert.equal(resolveAnnouncementAzanDeviceAudio({ bundledSounds: [combined] }, { ...base, nativeSound: null }).nativeSound, null, 'sound OFF stays silent');
  const otherScope = { ...base, data: { audioScope: 'prayer_time_azan', iosCombinedSound: combined } };
  assert.equal(resolveAnnouncementAzanDeviceAudio({ bundledSounds: [combined] }, otherScope).nativeSound, 'nasser_al_qatami');

  // ---- 4. Prayer-time payload for announcement_azan -----------------------------------------
  const originalCreateMany = prisma.azanReminderSendLog.createMany;
  const originalNow = Date.now;
  const originalFind = prisma.user.findUnique;
  const originalNotification = prisma.notification.create;
  const prayer = new Date('2026-10-09T09:40:00Z'); // Friday Dhuhr in Cairo
  const user: any = {
    id: 'flow-user', timezone: 'Africa/Cairo', latitude: 30.0444, longitude: 31.2357, city: 'Cairo',
    prayerCalculationMethod: 'EGYPT', azanPreferences: { localScheduledUntil: null },
  };
  const built = buildAzanPreferencesFromUser(user);
  const memo = new Map<any, any>([[[built.lastLat ?? user.latitude, built.lastLng ?? user.longitude,
    user.timezone, built.calculationMethod, String(built.madhab).toUpperCase(), 'profile'].join('|'),
    { timezone: user.timezone, instants: [{ key: 'DHUHR', date: '2026-10-09', time: '12:40', timestamp: prayer }] }]]);
  const claimed = new Set<string>();
  const payloads: any[] = [];
  const send: any = async (_id: string, payload: any) => { payloads.push(payload); return { sent: 1, failed: 0 }; };
  try {
    Date.now = () => prayer.getTime() + 1500;
    prisma.user.findUnique = (async () => user) as any;
    prisma.azanReminderSendLog.createMany = (async (args: any) => {
      const key = args.data[0].occurrenceKey;
      if (claimed.has(key)) return { count: 0 };
      claimed.add(key);
      return { count: 1 };
    }) as any;
    prisma.notification.create = (async () => null) as any;

    await runAzanRemindersForUser(user, 10, memo, send);
    assert.equal(payloads.length, 1);
    const p = payloads[0];
    assert.equal(p.data.prayerTimeSoundMode, 'announcement_azan');
    assert.equal(p.data.audioScope, 'prayer_time_announcement_azan');
    assert.equal(p.data.announcementSoundId, 'sc_event_jumuah');
    assert.equal(p.data.announcementNativeSound, 'sc_event_jumuah');
    assert.ok(p.data.announcementSoundUrl.endsWith('/sc_event_jumuah.mp3'));
    assert.equal(p.data.iosCombinedSound, `announce_azan_jumuah_${built.azanSoundId}`);
    // Android channel + default sound stay the Azan (old builds keep working).
    assert.equal(p.nativeSound, built.azanSoundId);
    assert.equal(p.androidChannelId, `azan_${built.azanSoundId}`);

    // Explicit "azan only" stays exactly as before.
    claimed.clear();
    user.azanPreferences.prayerTimeSoundMode = 'azan';
    await runAzanRemindersForUser(user, 10, memo, send);
    assert.equal(payloads[1].data.audioScope, 'prayer_time_azan');
    assert.equal(payloads[1].data.iosCombinedSound, undefined);

    // Per-prayer override to announcement_azan.
    claimed.clear();
    user.azanPreferences.prayerTimeSoundOverrides = { dhuhr: 'announcement_azan' };
    await runAzanRemindersForUser(user, 10, memo, send);
    assert.equal(payloads[2].data.prayerTimeSoundMode, 'announcement_azan');
  } finally {
    prisma.azanReminderSendLog.createMany = originalCreateMany;
    Date.now = originalNow;
    prisma.user.findUnique = originalFind;
    prisma.notification.create = originalNotification;
  }

  // ---- 5. Duha / Qiyam coverage -------------------------------------------------------------
  const legacy = { localScheduledUntil: '2026-11-12T00:00:00+02:00' };
  assert.deepEqual(readExtraPrayerCoverage(legacy, 'DUHA'), { reported: false, until: null });
  assert.equal(extraPrayerCoverageInstant(legacy, 'DUHA'), legacy.localScheduledUntil, 'old builds: Azan coverage');
  assert.equal(extraPrayerCoverageInstant(null, 'QIYAM'), null);

  // App reports Duha coverage.
  const afterDuha = nextExtraPrayerCoverage(legacy, 'DUHA', { localScheduledUntil: '2026-11-11T09:30:00+02:00' })!;
  assert.equal(extraPrayerCoverageInstant(afterDuha, 'DUHA'), '2026-11-11T09:30:00+02:00');
  assert.equal(afterDuha.localScheduledUntil, legacy.localScheduledUntil, 'Azan coverage untouched');
  assert.equal(extraPrayerCoverageInstant(afterDuha, 'QIYAM'), legacy.localScheduledUntil, 'Qiyam not reported yet → legacy');

  // App could not schedule Qiyam → null → server must send the backup despite Azan coverage.
  const afterQiyamFail = nextExtraPrayerCoverage(afterDuha, 'QIYAM', { localScheduledUntil: null })!;
  assert.equal(extraPrayerCoverageInstant(afterQiyamFail, 'QIYAM'), null);
  assert.deepEqual(readExtraPrayerCoverage(afterQiyamFail, 'QIYAM'), { reported: true, until: null });

  // Time change without new coverage clears only that kind, only when reported.
  const afterTime = nextExtraPrayerCoverage(afterQiyamFail, 'DUHA', { time: '10:00' })!;
  assert.equal(extraPrayerCoverageInstant(afterTime, 'DUHA'), null);
  assert.equal(nextExtraPrayerCoverage(legacy, 'DUHA', { time: '10:00' }), null, 'old builds: nothing written');
  assert.equal(nextExtraPrayerCoverage(legacy, 'DUHA', { enabled: true }), null);

  // The JSON survives the Azan preferences schema (no stripping) and rejects garbage.
  const parsed = azanPreferencesSchema.parse({ extraPrayerLocalScheduledUntil: afterTime.extraPrayerLocalScheduledUntil });
  assert.deepEqual(parsed.extraPrayerLocalScheduledUntil, afterTime.extraPrayerLocalScheduledUntil);
  assert.equal(azanPreferencesSchema.safeParse({ extraPrayerLocalScheduledUntil: { duha: 'tomorrow' } }).success, false);
  assert.equal(azanPreferencesSchema.safeParse({ extraPrayerLocalScheduledUntil: { fajr: null } }).success, false);

  // PATCH body validation.
  assert.ok(extraPrayerPreferencesPatchSchema.safeParse({ localScheduledUntil: '2026-11-11T09:30:00+02:00' }).success);
  assert.ok(extraPrayerPreferencesPatchSchema.safeParse({ localScheduledUntil: null }).success);
  assert.equal(extraPrayerPreferencesPatchSchema.safeParse({ localScheduledUntil: '2026-11-11 09:30' }).success, false);
  assert.equal(extraPrayerPreferencesPatchSchema.safeParse({}).success, false);

  console.log('Prayer sound flow passed: announcement_azan default + per-device iOS clip, sc_near_auto default, Duha/Qiyam own coverage. No DB/network.');
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
