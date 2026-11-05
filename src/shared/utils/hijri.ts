/**
 * Umm al-Qura Hijri helpers on local calendar day keys (YYYY-MM-DD).
 * `offsetDays` is the user's moon-sighting correction (-2..2): local Hijri date = Umm al-Qura(date + offset).
 */
export type HijriParts = { year: number; month: number; day: number };

const formatter = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
  timeZone: 'UTC', year: 'numeric', month: 'numeric', day: 'numeric',
});

export const RAMADAN_MONTH = 9;
export const SHAWWAL_MONTH = 10;
export const DHUL_HIJJAH_MONTH = 12;

export function shiftDayKey(dayKey: string, days: number): string {
  const date = new Date(dayKey + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(fromDayKey: string, toDayKey: string): number {
  return Math.round((Date.parse(toDayKey + 'T12:00:00Z') - Date.parse(fromDayKey + 'T12:00:00Z')) / 86400000);
}

export function isDayKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const partsCache = new Map<string, HijriParts>();
export function hijriOfDayKey(dayKey: string, offsetDays = 0): HijriParts {
  const key = offsetDays ? shiftDayKey(dayKey, offsetDays) : dayKey;
  const cached = partsCache.get(key);
  if (cached) return cached;
  const parts = formatter.formatToParts(new Date(key + 'T12:00:00Z'));
  const pick = (type: string) => Number(parts.find(p => p.type === type)?.value);
  const result = { year: pick('year'), month: pick('month'), day: pick('day') };
  if (partsCache.size > 4096) partsCache.clear();
  partsCache.set(key, result);
  return result;
}

function compare(a: HijriParts, b: HijriParts): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

/** Gregorian day key whose local Hijri date (with offset) is `target`; null when that date does not exist (day 30 of a 29-day month). */
export function dayKeyForHijri(target: HijriParts, offsetDays = 0): string | null {
  // Mean Hijri year is 354.367 days; 1 Muharram 1448 is 2026-06-16.
  const approxDays = Math.round((target.year - 1448) * 354.367 + (target.month - 1) * 29.53 + (target.day - 1));
  let cursor = shiftDayKey('2026-06-16', approxDays);
  for (let step = 0; step < 80; step++) {
    const order = compare(hijriOfDayKey(cursor, offsetDays), target);
    if (order === 0) return cursor;
    const next = shiftDayKey(cursor, order < 0 ? 1 : -1);
    const nextOrder = compare(hijriOfDayKey(next, offsetDays), target);
    if (nextOrder === 0) return next;
    if (Math.sign(nextOrder) !== Math.sign(order)) return null;
    cursor = next;
  }
  return null;
}

export function ramadanStartDayKey(hijriYear: number, offsetDays = 0): string {
  const key = dayKeyForHijri({ year: hijriYear, month: RAMADAN_MONTH, day: 1 }, offsetDays);
  if (!key) throw new Error('Ramadan start not found for ' + hijriYear);
  return key;
}

export type FastingBlockReason = 'RAMADAN' | 'EID_AL_FITR' | 'EID_AL_ADHA' | 'TASHREEQ';

/** Why a make-up (qada) fast is not allowed on this local day, or null. Ramadan days belong to Ramadan itself. */
export function qadaFastingBlockReason(dayKey: string, offsetDays = 0): FastingBlockReason | null {
  const h = hijriOfDayKey(dayKey, offsetDays);
  if (h.month === RAMADAN_MONTH) return 'RAMADAN';
  if (h.month === SHAWWAL_MONTH && h.day === 1) return 'EID_AL_FITR';
  if (h.month === DHUL_HIJJAH_MONTH && h.day === 10) return 'EID_AL_ADHA';
  if (h.month === DHUL_HIJJAH_MONTH && h.day >= 11 && h.day <= 13) return 'TASHREEQ';
  return null;
}
