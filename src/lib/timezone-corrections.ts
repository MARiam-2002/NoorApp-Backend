/**
 * Legal-time changes newer than the runtime's ICU tz database.
 *
 * Morocco returned to GMT (UTC+0, no DST, no Ramadan switch) on 2026-09-20 by
 * Decree 2.26.530 (Bulletin Officiel 7521). Node 24 ships tzdata 2026b, which still
 * has Africa/Casablanca and Africa/El_Aaiun at UTC+1, so every formatted prayer time
 * in Morocco would read one hour late. While the runtime still has the old rule,
 * those zones are formatted as UTC+0. The check is data-driven: once Node ships the
 * updated tzdata the correction disables itself.
 */
const MOROCCO_ZONES = new Set(['africa/casablanca', 'africa/el_aaiun']);
const PROBE = Date.UTC(2026, 9, 1, 12, 0, 0);

function runtimeHasMoroccoGmt(): boolean {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Casablanca',
    hour: 'numeric',
    hourCycle: 'h23',
  }).format(PROBE);
  return Number(hour) === 12;
}

export const moroccoGmtCorrectionActive = !runtimeHasMoroccoGmt();

if (moroccoGmtCorrectionActive) {
  const NativeDateTimeFormat = Intl.DateTimeFormat;
  const Corrected = function DateTimeFormat(
    locales?: string | string[],
    options?: Intl.DateTimeFormatOptions,
  ) {
    const zone = options?.timeZone;
    const next =
      typeof zone === 'string' && MOROCCO_ZONES.has(zone.toLowerCase())
        ? { ...options, timeZone: 'Etc/UTC' }
        : options;
    return new NativeDateTimeFormat(locales, next);
  } as unknown as typeof Intl.DateTimeFormat;
  Object.defineProperty(Corrected, 'prototype', { value: NativeDateTimeFormat.prototype });
  Corrected.supportedLocalesOf = NativeDateTimeFormat.supportedLocalesOf.bind(NativeDateTimeFormat);
  Intl.DateTimeFormat = Corrected;
}
