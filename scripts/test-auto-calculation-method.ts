/**
 * AUTO calculation method: official method per country from coordinates (no HTTP / no DB).
 * Run: npx tsx scripts/test-auto-calculation-method.ts
 */
import assert from 'node:assert/strict';
import { calculateDailyPrayerSchedule } from '../src/services/prayer.service';
import { buildAzanPreferencesFromUser, pickExplicitAzanPatch } from '../src/services/azan.service';
import {
  autoCalculationMethodFor,
  isAutoCalculationMethod,
  isUnsetStoredCalculationMethod,
} from '../src/shared/utils/auto-calculation-method';
import { CALCULATION_METHODS_CATALOG, DEFAULT_PRAYER_LOCATION } from '../src/shared/constants/default-location';

const TABUK = { lat: 28.3835, lng: 36.5662, tz: 'Asia/Riyadh' };

function times(lat: number, lng: number, tz: string, method: string | undefined, iso: string) {
  const s = calculateDailyPrayerSchedule(lat, lng, tz, [], new Date(iso), { method, locationSource: 'profile' });
  return { s, byKey: Object.fromEntries(s.schedule.map((r) => [r.key, r.time])) as Record<string, string> };
}

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h as number) * 60 + (m as number);
}

console.log('--- 1) Country -> official method ---');
const cities: [string, number, number, string][] = [
  ['Tabuk', 28.3835, 36.5662, 'MAKKAH'],
  ['Riyadh', 24.7136, 46.6753, 'MAKKAH'],
  ['Jeddah', 21.4858, 39.1925, 'MAKKAH'],
  ['Makkah', 21.3891, 39.8579, 'MAKKAH'],
  ['Dammam', 26.4207, 50.0888, 'MAKKAH'],
  ['Abha', 18.2164, 42.5053, 'MAKKAH'],
  ['Cairo', 30.0444, 31.2357, 'EGYPT'],
  ['Alexandria', 31.2001, 29.9187, 'EGYPT'],
  ['Aswan', 24.0889, 32.8998, 'EGYPT'],
  ['Kuwait', 29.3759, 47.9774, 'KUWAIT'],
  ['Doha', 25.2854, 51.531, 'QATAR'],
  ['Dubai', 25.2048, 55.2708, 'DUBAI'],
  ['Istanbul', 41.0082, 28.9784, 'TURKEY'],
  ['Tehran', 35.6892, 51.389, 'TEHRAN'],
  ['Karachi', 24.8607, 67.0011, 'KARACHI'],
  ['Dhaka', 23.8103, 90.4125, 'KARACHI'],
  ['Kuala Lumpur', 3.139, 101.6869, 'SINGAPORE'],
  ['Jakarta', -6.2088, 106.8456, 'KEMENAG'],
  ['London', 51.5074, -0.1278, 'MOONSIGHTING'],
  ['New York', 40.7128, -74.006, 'ISNA'],
  ['Toronto', 43.6532, -79.3832, 'ISNA'],
  ['Amman', 31.9539, 35.9106, 'EGYPT'],
  ['Baghdad', 33.3152, 44.3661, 'EGYPT'],
  ['Khartoum', 15.5007, 32.5599, 'EGYPT'],
  ['Casablanca', 33.5731, -7.5898, 'EGYPT'],
  ['Paris', 48.8566, 2.3522, 'MWL'],
  ['Berlin', 52.52, 13.405, 'MWL'],
  ['Sydney', -33.8688, 151.2093, 'MWL'],
  ['Mexico City', 19.4326, -99.1332, 'MWL'],
];
for (const [name, lat, lng, expected] of cities) {
  assert.equal(autoCalculationMethodFor(lat, lng), expected, name);
}
const catalogIds = new Set(CALCULATION_METHODS_CATALOG.map((m) => m.id));
for (const [, lat, lng] of cities) assert.ok(catalogIds.has(autoCalculationMethodFor(lat, lng)));

console.log('--- 2) Tabuk 2026-09-30 AUTO matches Umm Al-Qura (Google: 05:05 12:24 15:48 18:21 19:51) ---');
const tabukAuto = times(TABUK.lat, TABUK.lng, TABUK.tz, 'AUTO', '2026-09-30T09:00:00Z');
const google: Record<string, string> = { FAJR: '05:05', DHUHR: '12:24', ASR: '15:48', MAGHRIB: '18:21', ISHA: '19:51' };
for (const [key, expected] of Object.entries(google)) {
  const diff = Math.abs(minutes(tabukAuto.byKey[key]!) - minutes(expected));
  assert.ok(diff <= 1, `Tabuk ${key} ${tabukAuto.byKey[key]} vs ${expected}`);
}
assert.equal(tabukAuto.byKey.ISHA, '19:51');
assert.equal(tabukAuto.s.calculationMethod, 'MAKKAH');
assert.equal(tabukAuto.s.calculationMethodSource, 'auto');

console.log('--- 3) Missing method = AUTO; explicit pick is respected ---');
assert.equal(times(TABUK.lat, TABUK.lng, TABUK.tz, undefined, '2026-09-30T09:00:00Z').byKey.ISHA, '19:51');
const tabukEgypt = times(TABUK.lat, TABUK.lng, TABUK.tz, 'EGYPT', '2026-09-30T09:00:00Z');
assert.equal(tabukEgypt.byKey.ISHA, '19:37', 'the reported wrong notification time');
assert.equal(tabukEgypt.s.calculationMethodSource, 'user');

console.log('--- 4) Egypt unchanged under AUTO ---');
const cairoAuto = times(30.0444, 31.2357, 'Africa/Cairo', 'AUTO', '2026-09-26T12:00:00Z');
const cairoEgypt = times(30.0444, 31.2357, 'Africa/Cairo', 'EGYPT', '2026-09-26T12:00:00Z');
assert.deepEqual(cairoAuto.byKey, cairoEgypt.byKey);
assert.equal(cairoAuto.s.calculationMethod, DEFAULT_PRAYER_LOCATION.calculationMethodLabel);

console.log('--- 5) Stored values ---');
assert.ok(isAutoCalculationMethod('AUTO') && isAutoCalculationMethod('') && isAutoCalculationMethod(null));
assert.ok(!isAutoCalculationMethod('EGYPTIAN_GENERAL_AUTHORITY_OF_SURVEY'), 'explicit long id in a query stays explicit');
assert.ok(isUnsetStoredCalculationMethod('EGYPTIAN_GENERAL_AUTHORITY_OF_SURVEY'), 'sign-up column default = unset');
assert.ok(!isUnsetStoredCalculationMethod('MAKKAH'));
assert.equal(DEFAULT_PRAYER_LOCATION.calculationMethod, 'AUTO');
assert.equal(CALCULATION_METHODS_CATALOG.filter((m) => m.isDefault).map((m) => m.id).join(), 'AUTO');

const tabukUser = { azanPreferences: null, latitude: TABUK.lat, longitude: TABUK.lng, city: 'Tabuk' };
const fresh = buildAzanPreferencesFromUser({ ...tabukUser, prayerCalculationMethod: 'EGYPTIAN_GENERAL_AUTHORITY_OF_SURVEY' });
assert.equal(fresh.calculationMethod, 'AUTO');
assert.equal(fresh.effectiveCalculationMethod, 'MAKKAH');
assert.equal(fresh.calculationMethodSource, 'auto');
const picked = buildAzanPreferencesFromUser({ ...tabukUser, prayerCalculationMethod: 'DIYANET' });
assert.equal(picked.effectiveCalculationMethod, 'TURKEY');
assert.equal(picked.calculationMethodSource, 'user');
const stored = buildAzanPreferencesFromUser({
  ...tabukUser,
  azanPreferences: { calculationMethod: 'AUTO', lastLat: TABUK.lat, lastLng: TABUK.lng },
  prayerCalculationMethod: 'AUTO',
});
assert.equal(stored.effectiveCalculationMethod, 'MAKKAH');
const noLocation = buildAzanPreferencesFromUser({
  azanPreferences: null, prayerCalculationMethod: null, latitude: null, longitude: null, city: null,
});
assert.equal(noLocation.effectiveCalculationMethod, 'EGYPT', 'no location = Cairo default');

console.log('--- 6) PATCH only changes the fields that were sent ---');
assert.deepEqual(pickExplicitAzanPatch({ soundEnabled: false }), { soundEnabled: false });
assert.deepEqual(pickExplicitAzanPatch({ madhab: 'hanafi', preReminderMinutes: '10' }), {
  madhab: 'hanafi',
  preReminderMinutes: 10,
});
assert.deepEqual(pickExplicitAzanPatch({ localScheduledUntil: null }), { localScheduledUntil: null });
assert.throws(() => pickExplicitAzanPatch({ preReminderMinutes: 500 }));

console.log('auto calculation method: OK');
