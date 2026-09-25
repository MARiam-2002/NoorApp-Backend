/**
 * Near-prayer voice resolver unit checks (no HTTP / DB).
 * Run: npx tsx scripts/test-near-prayer-resolver.ts
 */
import assert from 'node:assert/strict';
import { resolvePreReminderSoundFor } from '../src/services/prayer-reminder.service';
import { AZAN_MEDIA_FILES } from '../src/shared/constants/azan-sounds';
import fs from 'node:fs';
import path from 'node:path';

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

const assets = path.join(process.cwd(), 'assets');
const required = [
  'near-prayer/sc_near_fajr.mp3',
  'near-prayer/sc_near_dhuhr.mp3',
  'near-prayer/sc_near_asr.mp3',
  'near-prayer/sc_near_maghrib.mp3',
  'near-prayer/sc_near_isha.mp3',
  'near-prayer/sc_near_jumuah.mp3',
];
for (const rel of required) {
  assert.ok(fs.existsSync(path.join(assets, rel)), `missing ${rel}`);
}

assert.ok(AZAN_MEDIA_FILES['sc_near_jumuah.mp3']?.relativePath.startsWith('near-prayer/'));
assert.equal((AZAN_MEDIA_FILES as any)['sc_fajr_alarm.mp3'], undefined);
assert.equal((AZAN_MEDIA_FILES as any)['sc_near_qiyam.mp3'], undefined);

// No near-prayer files under notification/ or azan/
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

console.log('near-prayer resolver: OK');
