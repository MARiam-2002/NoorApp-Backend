/**
 * Near-Prayer production audit tests (no HTTP required for core contract).
 * Run: npx tsx scripts/test-near-prayer-audit.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildAzanNotificationCopy,
  buildAzanReminderOccurrenceKey,
  classifyAzanReminderHit,
  computeNearPrayerLocalHhmm,
  minutesUntilPrayer,
  resolvePreReminderSoundFor,
} from '../src/services/prayer-reminder.service';
import {
  azanPreferencesSchema,
  DEFAULT_PRE_REMINDER_MINUTES,
  defaultAzanPreferences,
} from '../src/services/azan.service';
import { getAzanSoundById, AZAN_MEDIA_FILES } from '../src/shared/constants/azan-sounds';
import { isCronRequestAuthorized } from '../src/routes/cron';

const WINDOW = 12;
const tzCairo = 'Africa/Cairo';
const tzAhead = 'Asia/Dubai'; // UTC+4
const tzBehind = 'America/New_York';
const thursday = new Date('2026-09-24T09:00:00.000Z');
const friday = new Date('2026-09-25T09:00:00.000Z');

function assertHit(
  mins: number,
  pre: number,
  enabled: boolean,
  expect: 'none' | 'pre_reminder' | 'prayer_time',
  label: string,
) {
  const got = classifyAzanReminderHit({
    minutesUntil: mins,
    preReminderMinutes: pre,
    preReminderEnabled: enabled,
    windowMinutes: WINDOW,
  });
  assert.equal(got, expect, `${label}: mins=${mins} pre=${pre} → ${got} (want ${expect})`);
}

console.log('--- 1) reminderMinutes / preReminderMinutes authority ---');
assert.equal(DEFAULT_PRE_REMINDER_MINUTES, 15);
assert.equal(defaultAzanPreferences().preReminderMinutes, 15);
assert.equal(computeNearPrayerLocalHhmm('05:00', 15), '04:45');
assert.equal(computeNearPrayerLocalHhmm('05:00', 10), '04:50');
assert.equal(computeNearPrayerLocalHhmm('05:00', 5), '04:55');
assert.equal(computeNearPrayerLocalHhmm('00:10', 15), '23:55');

console.log('--- 2) classify: 15 / 10 / 5 ---');
// Target: fire pre when mins ≈ pre
assertHit(15, 15, true, 'pre_reminder', 'pre15@15');
assertHit(14, 15, true, 'pre_reminder', 'pre15@14');
assertHit(20, 15, true, 'pre_reminder', 'pre15@20 within window');
assertHit(28, 15, true, 'none', 'pre15@28 outside window');
assertHit(10, 10, true, 'pre_reminder', 'pre10@10');
assertHit(8, 10, true, 'pre_reminder', 'pre10@8');
assertHit(5, 5, true, 'pre_reminder', 'pre5@5 must NOT be swallowed by prayer_time');
assertHit(3, 5, true, 'pre_reminder', 'pre5@3 closer to pre than 0');
assertHit(1, 5, true, 'prayer_time', 'pre5@1 closer to prayer');
assertHit(0, 15, true, 'prayer_time', 'at prayer');
assertHit(5, 15, true, 'prayer_time', 'between pre and prayer → prayer_time');

console.log('--- 3) reminder disabled ---');
assertHit(15, 15, false, 'none', 'disabled@15');
assertHit(5, 15, false, 'prayer_time', 'disabled still allows prayer_time');

console.log('--- 4) prefs validation ---');
assert.equal(azanPreferencesSchema.parse({ preReminderMinutes: 10 }).preReminderMinutes, 10);
assert.equal(azanPreferencesSchema.parse({ preReminderMinutes: '5' }).preReminderMinutes, 5);
assert.throws(() => azanPreferencesSchema.parse({ preReminderMinutes: -1 }));
assert.throws(() => azanPreferencesSchema.parse({ preReminderMinutes: 121 }));
assert.throws(() => azanPreferencesSchema.parse({ preReminderMinutes: 1.5 }));
// null → default via coerce failure or default — zod coerce null → 0 in some versions; require explicit
const withNull = azanPreferencesSchema.safeParse({ preReminderMinutes: null });
// coerce.number(null) => 0 in zod 3 — 0 is allowed by min(0)
if (withNull.success) {
  assert.ok(withNull.data.preReminderMinutes >= 0 && withNull.data.preReminderMinutes <= 120);
}

console.log('--- 5) Arabic titles ---');
const expected: Record<string, string> = {
  FAJR: 'بعد 15 دقيقة يحين موعد صلاة الفجر',
  DHUHR: 'بعد 15 دقيقة يحين موعد صلاة الظهر',
  ASR: 'بعد 15 دقيقة يحين موعد صلاة العصر',
  MAGHRIB: 'بعد 15 دقيقة يحين موعد صلاة المغرب',
  ISHA: 'بعد 15 دقيقة يحين موعد صلاة العشاء',
};
for (const [k, title] of Object.entries(expected)) {
  const c = buildAzanNotificationCopy({
    prayerNameOrKey: k,
    time: '05:00',
    isPre: true,
    preReminderMinutes: 15,
    evaluationTimezone: tzCairo,
    nowUtc: thursday,
  });
  assert.equal(c.titleAr, title);
  assert.equal(c.eventType, 'PRE_PRAYER_REMINDER');
}
const oneMin = buildAzanNotificationCopy({
  prayerNameOrKey: 'ASR',
  time: '15:00',
  isPre: true,
  preReminderMinutes: 1,
  evaluationTimezone: tzCairo,
  nowUtc: thursday,
});
assert.equal(oneMin.titleAr, 'بعد دقيقة يحين موعد صلاة العصر');
const azanCopy = buildAzanNotificationCopy({
  prayerNameOrKey: 'ASR',
  time: '15:00',
  isPre: false,
  preReminderMinutes: 15,
  evaluationTimezone: tzCairo,
  nowUtc: thursday,
});
assert.equal(azanCopy.titleAr, 'حان الآن موعد أذان العصر');
assert.equal(azanCopy.eventType, 'PRAYER_AZAN');
const jum = buildAzanNotificationCopy({
  prayerNameOrKey: 'DHUHR',
  time: '12:00',
  isPre: true,
  preReminderMinutes: 15,
  evaluationTimezone: tzCairo,
  nowUtc: friday,
});
assert.equal(jum.titleAr, 'بعد 15 دقيقة يحين موعد صلاة الجمعة');
assert.equal(jum.isFridayJumuahPre, true);

console.log('--- 6) Sound mapping + Azan separation ---');
const azanBefore = getAzanSoundById('mishary_alafasy');
for (const [prayer, id] of [
  ['FAJR', 'sc_near_fajr'],
  ['DHUHR', 'sc_near_dhuhr'],
  ['ASR', 'sc_near_asr'],
  ['MAGHRIB', 'sc_near_maghrib'],
  ['ISHA', 'sc_near_isha'],
] as const) {
  const r = resolvePreReminderSoundFor(prayer, 'sc_near_auto', 15, tzCairo, thursday);
  assert.equal(r.sound.id, id);
  assert.equal(r.sound.mediaFile, `${id}.mp3`);
}
const friSound = resolvePreReminderSoundFor('DHUHR', 'sc_near_auto', 15, tzCairo, friday);
assert.equal(friSound.sound.id, 'sc_near_jumuah');
assert.equal(friSound.sound.mediaFile, 'sc_near_jumuah.mp3');
const thuSound = resolvePreReminderSoundFor('DHUHR', 'sc_near_auto', 15, tzCairo, thursday);
assert.notEqual(thuSound.sound.id, 'sc_near_jumuah');
const azanAfter = getAzanSoundById('mishary_alafasy');
assert.equal(azanBefore.id, azanAfter.id);
assert.equal(azanAfter.mediaFile, 'mishary_alafasy.mp3');
// Explicit soft_chime must not auto-match near clips
const soft = resolvePreReminderSoundFor('FAJR', 'soft_chime', 15, tzCairo, thursday);
assert.equal(soft.autoMatched, false);
assert.equal(soft.sound.id, 'soft_chime');

console.log('--- 7) Filesystem ---');
const assets = path.join(process.cwd(), 'assets', 'near-prayer');
for (const f of [
  'sc_near_fajr.mp3',
  'sc_near_dhuhr.mp3',
  'sc_near_asr.mp3',
  'sc_near_maghrib.mp3',
  'sc_near_isha.mp3',
  'sc_near_jumuah.mp3',
]) {
  assert.ok(fs.existsSync(path.join(assets, f)), f);
}
assert.ok(!fs.existsSync(path.join(assets, 'sc_near_jummah.mp3')));
assert.ok(AZAN_MEDIA_FILES['sc_near_jumuah.mp3']?.relativePath.startsWith('near-prayer/'));

console.log('--- 8) Timezone (minutesUntil uses user TZ, not server) ---');
// 2026-09-24 02:00 UTC = 05:00 Cairo (UTC+3), 06:00 Dubai (UTC+4), 22:00 prev day NY (EDT UTC-4)
const fixed = new Date('2026-09-24T02:00:00.000Z');
assert.equal(minutesUntilPrayer('05:00', tzCairo, fixed), 0);
assert.equal(minutesUntilPrayer('06:00', tzAhead, fixed), 0);
// NY local at that instant is 2026-09-23 22:00 — until 05:00 next calendar day same HH:mm formula is same-day only
const nyMins = minutesUntilPrayer('22:00', tzBehind, fixed);
assert.equal(nyMins, 0);

console.log('--- 9) Idempotency keys include pre minutes ---');
const k15 = buildAzanReminderOccurrenceKey({
  date: '2026-09-25',
  prayerKey: 'FAJR',
  kind: 'pre_reminder',
  preReminderMinutes: 15,
});
const k10 = buildAzanReminderOccurrenceKey({
  date: '2026-09-25',
  prayerKey: 'FAJR',
  kind: 'pre_reminder',
  preReminderMinutes: 10,
});
assert.equal(k15, '2026-09-25|FAJR|pre_reminder|pre15');
assert.equal(k10, '2026-09-25|FAJR|pre_reminder|pre10');
assert.notEqual(k15, k10);
const kPrayer = buildAzanReminderOccurrenceKey({
  date: '2026-09-25',
  prayerKey: 'FAJR',
  kind: 'prayer_time',
});
assert.equal(kPrayer, '2026-09-25|FAJR|prayer_time');

console.log('--- 10) Cron auth ---');
assert.equal(isCronRequestAuthorized('', { headers: {}, query: {} }), false);
assert.equal(
  isCronRequestAuthorized('secret', {
    headers: { authorization: 'Bearer secret' },
    query: {},
  }),
  true,
);
assert.equal(
  isCronRequestAuthorized('secret', {
    headers: { authorization: 'Bearer wrong' },
    query: {},
  }),
  false,
);
assert.equal(
  isCronRequestAuthorized('secret', {
    headers: { 'x-cron-secret': 'secret' },
    query: {},
  }),
  true,
);

console.log('--- 11) FCM-shaped payload contract (pre) ---');
const fajrCopy = buildAzanNotificationCopy({
  prayerNameOrKey: 'FAJR',
  time: '05:00',
  isPre: true,
  preReminderMinutes: 15,
  evaluationTimezone: tzCairo,
  nowUtc: thursday,
});
const sound = resolvePreReminderSoundFor('FAJR', 'sc_near_auto', 15, tzCairo, thursday);
const payload = {
  type: 'AZAN',
  kind: 'pre_reminder',
  key: 'FAJR',
  prayer: 'Fajr',
  time: '05:00',
  nearPrayerLocalTime: computeNearPrayerLocalHhmm('05:00', 15),
  preReminderMinutes: '15',
  reminderMinutes: '15',
  notificationSoundId: sound.sound.id,
  notificationSoundMediaFile: sound.sound.mediaFile,
  titleAr: fajrCopy.titleAr,
  androidChannelId: 'azan-reminder',
  nativeSound: String(sound.sound.mediaFile).replace(/\.mp3$/i, ''),
  azanSoundId: getAzanSoundById('mishary_alafasy').id,
};
assert.equal(payload.nearPrayerLocalTime, '04:45');
assert.equal(payload.notificationSoundId, 'sc_near_fajr');
assert.equal(payload.nativeSound, 'sc_near_fajr');
assert.equal(payload.titleAr, 'بعد 15 دقيقة يحين موعد صلاة الفجر');
assert.equal(payload.azanSoundId, 'mishary_alafasy');
assert.notEqual(payload.notificationSoundId, payload.azanSoundId);

// Prayer-event assets present
for (const f of [
  'prayer-events/sc_event_fajr.mp3',
  'prayer-events/sc_event_dhuhr.mp3',
  'prayer-events/sc_event_asr.mp3',
  'prayer-events/sc_event_maghrib.mp3',
  'prayer-events/sc_event_isha.mp3',
  'prayer-events/sc_event_jumuah.mp3',
  'prayer-events/sc_event_duha.mp3',
  'prayer-events/sc_event_qiyam.mp3',
]) {
  assert.ok(fs.existsSync(path.join(process.cwd(), 'assets', f)), f);
}

console.log('near-prayer production audit: OK');
