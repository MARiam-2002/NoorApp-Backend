/**
 * Qiyam reminder "last third of the night": formula against adhan's SunnahTimes, night selection around midnight,
 * stored timing defaults/bounds, and the PATCH schema. No database.
 *
 *   npx tsx scripts/test-qiyam-last-third.ts
 */
import assert from 'node:assert/strict';
import { CalculationMethod, Coordinates, PrayerTimes, SunnahTimes } from 'adhan';
import { lastThirdOfNight, qiyamLastThirdTarget, readQiyamTiming } from '../src/services/extra-prayer-reminder.service';
import { extraPrayerPreferencesPatchSchema } from '../src/controllers/extra-prayer.controller';
import { computePrayerInstantsAround } from '../src/services/prayer.service';

const cairo = { latitude: 30.0444, longitude: 31.2357, timezone: 'Africa/Cairo', city: 'Cairo', prayerCalculationMethod: 'EGYPTIAN_GENERAL_AUTHORITY_OF_SURVEY', azanPreferences: {} };

// Formula: Maghrib + 2/3 of (next Fajr − Maghrib), from the app's own prayer engine.
const t = lastThirdOfNight(cairo, '2026-11-13')!;
const inst = computePrayerInstantsAround({ latitude: cairo.latitude, longitude: cairo.longitude, timezone: cairo.timezone, locationSource: 'profile', now: new Date('2026-11-13T12:00:00Z'), method: 'EGYPTIAN_GENERAL_AUTHORITY_OF_SURVEY' }).instants;
const maghrib = inst.find(i => i.key === 'MAGHRIB' && i.date === '2026-11-13')!.timestamp.getTime();
const fajr = inst.find(i => i.key === 'FAJR' && i.date === '2026-11-14')!.timestamp.getTime();
assert.ok(Math.abs(t.getTime() - (maghrib + (fajr - maghrib) * 2 / 3)) < 60000, 'two thirds of the night after Maghrib');
assert.ok(t.getTime() > maghrib && t.getTime() < fajr);

// Same result as adhan's SunnahTimes (what the Flutter app uses to schedule locally), within a minute.
const params = CalculationMethod.Egyptian();
const pt = new PrayerTimes(new Coordinates(cairo.latitude, cairo.longitude), new Date(2026, 10, 13), params);
const sunnah = new SunnahTimes(pt);
assert.ok(Math.abs(sunnah.lastThirdOfTheNight.getTime() - t.getTime()) <= 60000, `adhan ${sunnah.lastThirdOfTheNight.toISOString()} vs ${t.toISOString()}`);

// Cairo in November is UTC+2: the last third starts in the small hours of the 14th, local time.
const local = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', hour: '2-digit', minute: '2-digit', hour12: false }).format(t);
assert.match(local, /^0[0-3]:\d{2}$/, local);

// Around midnight the reminder belongs to the night that started yesterday evening.
const at1am = qiyamLastThirdTarget(cairo, 0, new Date('2026-11-13T23:00:00Z'), 'Africa/Cairo')!; // 01:00 local on the 14th
assert.equal(at1am.at.getTime(), t.getTime());
assert.equal(at1am.dayKey, '2026-11-14');
const evening = qiyamLastThirdTarget(cairo, 15, new Date('2026-11-13T18:00:00Z'), 'Africa/Cairo')!; // 20:00 local
assert.equal(evening.at.getTime(), t.getTime() + 15 * 60000, 'tonight + offset');

// No location → null (the runner then uses the fixed time).
assert.equal(lastThirdOfNight({ ...cairo, latitude: null, longitude: null }, '2026-11-13'), null);

// Stored timing.
assert.deepEqual(readQiyamTiming(null), { mode: 'FIXED', offsetMinutes: 0 });
assert.deepEqual(readQiyamTiming({ qiyamTiming: { mode: 'LAST_THIRD', offsetMinutes: 20 } }), { mode: 'LAST_THIRD', offsetMinutes: 20 });
assert.deepEqual(readQiyamTiming({ qiyamTiming: { mode: 'NOPE', offsetMinutes: 999 } }), { mode: 'FIXED', offsetMinutes: 0 });

// PATCH body.
assert.equal(extraPrayerPreferencesPatchSchema.safeParse({ timingMode: 'LAST_THIRD' }).success, true);
assert.equal(extraPrayerPreferencesPatchSchema.safeParse({ offsetMinutes: 30 }).success, true);
assert.equal(extraPrayerPreferencesPatchSchema.safeParse({ offsetMinutes: 61 }).success, false);
assert.equal(extraPrayerPreferencesPatchSchema.safeParse({ timingMode: 'MIDNIGHT' }).success, false);
assert.equal(extraPrayerPreferencesPatchSchema.safeParse({}).success, false);

console.log(`qiyam last-third tests: ALL PASSED (Cairo 13→14 Nov 2026 starts ${local})`);
