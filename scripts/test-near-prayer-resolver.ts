/**
 * Near-prayer voice resolver + Arabic copy unit checks (no HTTP / DB).
 * Run: npx tsx scripts/test-near-prayer-resolver.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildAzanNotificationCopy,
  resolvePreReminderSoundFor,
  computeNearPrayerLocalHhmm,
} from '../src/services/prayer-reminder.service';
import { AZAN_MEDIA_FILES } from '../src/shared/constants/azan-sounds';

const tz = 'Africa/Cairo';
const friday = new Date('2026-09-25T09:00:00.000Z'); // Friday
const thursday = new Date('2026-09-24T09:00:00.000Z'); // Thursday

const soft = resolvePreReminderSoundFor('FAJR', 'soft_chime', 10, tz, thursday);
assert.equal(soft.autoMatched, false);
assert.equal(soft.sound.id, 'soft_chime');

const fajr = resolvePreReminderSoundFor('FAJR', 'sc_near_auto', 5, tz, thursday);
assert.equal(fajr.autoMatched, true);
assert.equal(fajr.sound.id, 'sc_near_fajr');
assert.equal(fajr.sound.mediaFile, 'sc_near_fajr.mp3');

const dhuhrThu = resolvePreReminderSoundFor('DHUHR', 'sc_near_auto', 10, tz, thursday);
assert.equal(dhuhrThu.sound.id, 'sc_near_dhuhr');

const dhuhrFri = resolvePreReminderSoundFor('DHUHR', 'sc_near_auto', 10, tz, friday);
assert.equal(dhuhrFri.sound.id, 'sc_near_jumuah');
assert.equal(dhuhrFri.sound.mediaFile, 'sc_near_jumuah.mp3');

for (const prayer of ['ASR', 'MAGHRIB', 'ISHA'] as const) {
  const r = resolvePreReminderSoundFor(prayer, 'sc_near_auto', 10, tz, thursday);
  assert.equal(r.sound.id, `sc_near_${prayer.toLowerCase()}`);
}

const expectedTitles: Record<string, string> = {
  FAJR: 'اقترب موعد صلاة الفجر',
  DHUHR: 'اقترب موعد صلاة الظهر',
  ASR: 'اقترب موعد صلاة العصر',
  MAGHRIB: 'اقترب موعد صلاة المغرب',
  ISHA: 'اقترب موعد صلاة العشاء',
};

for (const [key, title] of Object.entries(expectedTitles)) {
  const copy = buildAzanNotificationCopy({
    prayerNameOrKey: key,
    time: '12:00',
    isPre: true,
    preReminderMinutes: 15,
    evaluationTimezone: tz,
    nowUtc: thursday,
  });
  assert.equal(copy.titleAr, title, `titleAr for ${key}`);
  assert.equal(copy.eventType, 'PRE_PRAYER');
  assert.equal(copy.eventKey, key);
}

const fridayCopy = buildAzanNotificationCopy({
  prayerNameOrKey: 'DHUHR',
  time: '12:05',
  isPre: true,
  preReminderMinutes: 15,
  evaluationTimezone: tz,
  nowUtc: friday,
});
assert.equal(fridayCopy.titleAr, 'اقترب موعد صلاة الجمعة');
assert.equal(fridayCopy.isFridayJumuahPre, true);
assert.equal(fridayCopy.eventType, 'PRE_PRAYER');

const fridayAzan = buildAzanNotificationCopy({
  prayerNameOrKey: 'DHUHR',
  time: '12:05',
  isPre: false,
  preReminderMinutes: 15,
  evaluationTimezone: tz,
  nowUtc: friday,
});
assert.equal(fridayAzan.titleAr, 'حان الآن موعد أذان الجمعة');
assert.equal(fridayAzan.eventType, 'JUMUAH');
assert.equal(fridayAzan.eventKey, 'JUMUAH');

const fajrAzan = buildAzanNotificationCopy({
  prayerNameOrKey: 'FAJR',
  time: '05:00',
  isPre: false,
  preReminderMinutes: 15,
  evaluationTimezone: tz,
  nowUtc: thursday,
});
assert.equal(fajrAzan.titleAr, 'حان الآن موعد أذان الفجر');
assert.equal(fajrAzan.eventType, 'PRAYER_AZAN');

// reminderMinutes shifts PRE local clock, not title wording
assert.equal(
  computeNearPrayerLocalHhmm('05:00', 15),
  '04:45',
);
assert.equal(computeNearPrayerLocalHhmm('05:00', 10), '04:50');
assert.equal(computeNearPrayerLocalHhmm('05:00', 5), '04:55');

const assets = path.join(process.cwd(), 'assets');
const required = [
  'near-prayer/sc_near_fajr.mp3',
  'near-prayer/sc_near_dhuhr.mp3',
  'near-prayer/sc_near_asr.mp3',
  'near-prayer/sc_near_maghrib.mp3',
  'near-prayer/sc_near_isha.mp3',
  'near-prayer/sc_near_jumuah.mp3',
  'prayer-events/sc_event_fajr.mp3',
  'prayer-events/sc_event_duha.mp3',
  'prayer-events/sc_event_qiyam.mp3',
  'prayer-events/sc_event_jumuah.mp3',
];
for (const rel of required) {
  assert.ok(fs.existsSync(path.join(assets, rel)), `missing ${rel}`);
}
assert.ok(!fs.existsSync(path.join(assets, 'near-prayer/sc_near_jummah.mp3')), 'jummah typo must not exist');

assert.ok(AZAN_MEDIA_FILES['sc_near_jumuah.mp3']?.relativePath.startsWith('near-prayer/'));
assert.ok(AZAN_MEDIA_FILES['sc_event_qiyam.mp3']?.relativePath.startsWith('prayer-events/'));
assert.equal((AZAN_MEDIA_FILES as any)['sc_fajr_alarm.mp3'], undefined);
assert.equal((AZAN_MEDIA_FILES as any)['sc_near_qiyam.mp3'], undefined);

const notifDir = path.join(assets, 'notification');
if (fs.existsSync(notifDir)) {
  for (const f of fs.readdirSync(notifDir)) {
    assert.ok(!f.startsWith('sc_near_'), `duplicate near-prayer file in notification/: ${f}`);
  }
}
const azanDir = path.join(assets, 'azan');
if (fs.existsSync(azanDir)) {
  for (const f of fs.readdirSync(azanDir)) {
    assert.ok(!f.startsWith('sc_near_'), `near-prayer file wrongly under azan/: ${f}`);
  }
}

console.log('near-prayer resolver + Arabic copy: OK');
