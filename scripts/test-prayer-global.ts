/**
 * Worldwide prayer-time + reminder-timing checks (no HTTP / no DB).
 * Run: npx tsx scripts/test-prayer-global.ts
 */
import assert from 'node:assert/strict';
import {
  calculateDailyPrayerSchedule,
  computePrayerInstantsAround,
} from '../src/services/prayer.service';
import { classifyAzanReminderHit } from '../src/services/prayer-reminder.service';
import { CALCULATION_METHODS_CATALOG } from '../src/shared/constants/default-location';
import { buildAzanPreferencesFromUser } from '../src/services/azan.service';

type Loc = { name: string; lat: number; lng: number; tz: string; method: string };

function schedule(loc: Loc, isoDate: string) {
  return calculateDailyPrayerSchedule(loc.lat, loc.lng, loc.tz, [], new Date(isoDate), {
    method: loc.method,
    locationSource: 'query',
  });
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h as number) * 60 + (m as number);
}

/** Replays one scheduler tick per minute and returns every reminder that would be sent. */
function replayTicks(loc: Loc, fromIso: string, hours: number, pre = 15) {
  const claimed = new Set<string>();
  const sent: { key: string; atMs: number; prayerMs: number; kind: string }[] = [];
  const start = new Date(fromIso).getTime();
  for (let t = start; t < start + hours * 3600_000; t += 60_000) {
    const now = new Date(t + 3_000);
    const { instants } = computePrayerInstantsAround({
      latitude: loc.lat,
      longitude: loc.lng,
      timezone: loc.tz,
      method: loc.method,
      madhab: 'SHAFI',
      locationSource: 'profile',
      now,
    });
    for (const i of instants) {
      const mins = Math.ceil((i.timestamp.getTime() - now.getTime()) / 60_000);
      const kind = classifyAzanReminderHit({ minutesUntil: mins, preReminderMinutes: pre, preReminderEnabled: true });
      if (kind === 'none') continue;
      const key = `${i.date}|${i.key}|${kind}`;
      if (claimed.has(key)) continue;
      claimed.add(key);
      sent.push({ key, atMs: now.getTime(), prayerMs: i.timestamp.getTime(), kind });
    }
  }
  return sent;
}

function assertOnTime(sent: ReturnType<typeof replayTicks>, pre: number, label: string) {
  for (const s of sent) {
    const target = s.kind === 'prayer_time' ? s.prayerMs : s.prayerMs - pre * 60_000;
    const lateSec = (s.atMs - target) / 1000;
    assert.ok(lateSec >= 0 && lateSec < 60, `${label} ${s.key}: ${lateSec}s from target`);
  }
}

const cairo: Loc = { name: 'Cairo', lat: 30.0444, lng: 31.2357, tz: 'Africa/Cairo', method: 'EGYPT' };
const riyadh: Loc = { name: 'Riyadh', lat: 24.7136, lng: 46.6753, tz: 'Asia/Riyadh', method: 'MAKKAH' };
const london: Loc = { name: 'London', lat: 51.5074, lng: -0.1278, tz: 'Europe/London', method: 'MWL' };
const tromso: Loc = { name: 'Tromso', lat: 69.6492, lng: 18.9553, tz: 'Europe/Oslo', method: 'MWL' };

console.log('--- 1) MENA unchanged by high-latitude rule (lat < 48) ---');
const cairoTimes = schedule(cairo, '2026-09-26T12:00:00Z').schedule.map((r) => r.time);
assert.deepEqual(cairoTimes, ['05:19', '12:47', '16:12', '18:47', '20:04']);

console.log('--- 2) High latitude summer: Isha before Fajr, not the same minute ---');
const londonJune = schedule(london, '2026-06-21T12:00:00Z').schedule;
const lIsha = londonJune.find((r) => r.key === 'ISHA')!;
const lFajr = londonJune.find((r) => r.key === 'FAJR')!;
assert.notEqual(lIsha.time, lFajr.time);
assert.ok(toMinutes(lIsha.time) > toMinutes('21:30'), `London Isha ${lIsha.time}`);

console.log('--- 3) Polar circle never throws ---');
for (const iso of ['2026-06-21T12:00:00Z', '2026-12-21T12:00:00Z']) {
  const rows = schedule(tromso, iso).schedule;
  assert.equal(rows.length, 5);
  for (const r of rows) assert.match(r.time, /^\d{2}:\d{2}$/);
}

console.log('--- 4) Umm al-Qura Ramadan Isha = Maghrib + 120 ---');
const ramadan = schedule(riyadh, '2026-03-01T12:00:00Z').schedule;
const normal = schedule(riyadh, '2026-09-26T12:00:00Z').schedule;
const gap = (rows: typeof ramadan) =>
  toMinutes(rows.find((r) => r.key === 'ISHA')!.time) - toMinutes(rows.find((r) => r.key === 'MAGHRIB')!.time);
assert.equal(gap(ramadan), 120);
assert.equal(gap(normal), 90);

console.log('--- 5) Every catalog method computes valid times ---');
for (const m of CALCULATION_METHODS_CATALOG) {
  const rows = schedule({ ...cairo, method: m.id }, '2026-09-26T12:00:00Z').schedule;
  assert.equal(rows.length, 5, m.id);
}
const egypt = schedule(cairo, '2026-09-26T12:00:00Z').schedule[0]!.time;
const turkey = schedule({ ...cairo, method: 'TURKEY' }, '2026-09-26T12:00:00Z').schedule[0]!.time;
assert.notEqual(egypt, turkey, 'TURKEY must not silently fall back to EGYPT');

console.log('--- 6) Legacy profile method maps to catalog id ---');
const prefs = buildAzanPreferencesFromUser({
  azanPreferences: null,
  prayerCalculationMethod: 'DIYANET',
  latitude: null,
  longitude: null,
  city: null,
});
assert.equal(prefs.calculationMethod, 'TURKEY');

console.log('--- 7) Per-minute ticks: on time, once each, across midnight ---');
for (const [loc, from] of [
  [cairo, '2026-09-26T00:00:00Z'],
  [london, '2026-06-21T18:00:00Z'],
  [tromso, '2026-06-21T18:00:00Z'],
] as const) {
  const sent = replayTicks(loc, from, 24);
  assertOnTime(sent, 15, loc.name);
  const azans = sent.filter((s) => s.kind === 'prayer_time').map((s) => s.key);
  assert.equal(new Set(azans).size, azans.length, `${loc.name} duplicate Azan`);
  assert.ok(azans.length >= 5, `${loc.name}: ${azans.length} Azan pushes in 24h`);
}

console.log('--- 8) Timezones with :30 / :45 / +14 offsets ---');
for (const loc of [
  { name: 'Delhi', lat: 28.6139, lng: 77.209, tz: 'Asia/Kolkata', method: 'KARACHI' },
  { name: 'Kathmandu', lat: 27.7172, lng: 85.324, tz: 'Asia/Kathmandu', method: 'KARACHI' },
  { name: 'Kiritimati', lat: 1.87, lng: -157.4, tz: 'Pacific/Kiritimati', method: 'MWL' },
] satisfies Loc[]) {
  const sent = replayTicks(loc, '2026-09-26T00:00:00Z', 24);
  assertOnTime(sent, 15, loc.name);
  assert.equal(sent.filter((s) => s.kind === 'prayer_time').length >= 5, true, loc.name);
}

console.log('prayer global: OK');
