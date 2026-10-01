import tzlookup from 'tz-lookup';

/** Stored/sent when the user has not picked a method: resolve the official method from the location. */
export const AUTO_CALCULATION_METHOD = 'AUTO';

/** Prisma column default for User.prayerCalculationMethod — set at sign-up, never picked in the app. */
const LEGACY_COLUMN_DEFAULT = 'EGYPTIAN_GENERAL_AUTHORITY_OF_SURVEY';

/**
 * Official authority per country, keyed by the country's IANA zone (tz-lookup returns
 * country-level zones, e.g. Asia/Riyadh for every Saudi city, Asia/Kuwait for Kuwait).
 */
const ZONE_METHOD: Record<string, string> = {
  'Asia/Riyadh': 'MAKKAH',
  'Asia/Kuwait': 'KUWAIT',
  'Asia/Qatar': 'QATAR',
  'Asia/Dubai': 'DUBAI',
  'Africa/Cairo': 'EGYPT',
  'Europe/Istanbul': 'TURKEY',
  'Asia/Tehran': 'TEHRAN',
  'Asia/Karachi': 'KARACHI',
  'Asia/Kolkata': 'KARACHI',
  'Asia/Calcutta': 'KARACHI',
  'Asia/Dhaka': 'KARACHI',
  'Asia/Kabul': 'KARACHI',
  'Asia/Kuala_Lumpur': 'SINGAPORE',
  'Asia/Kuching': 'SINGAPORE',
  'Asia/Singapore': 'SINGAPORE',
  'Asia/Brunei': 'SINGAPORE',
  'Asia/Jakarta': 'KEMENAG',
  'Asia/Pontianak': 'KEMENAG',
  'Asia/Makassar': 'KEMENAG',
  'Asia/Jayapura': 'KEMENAG',
  'Europe/London': 'MOONSIGHTING',
  'Pacific/Honolulu': 'ISNA',
};

/** Arab and North African countries without their own method in the catalog keep the Egyptian method. */
const EGYPTIAN_METHOD_ZONES = new Set([
  'Asia/Amman', 'Asia/Damascus', 'Asia/Beirut', 'Asia/Baghdad', 'Asia/Gaza', 'Asia/Hebron',
  'Asia/Jerusalem', 'Asia/Aden', 'Asia/Muscat', 'Asia/Bahrain',
  'Africa/Khartoum', 'Africa/Tripoli', 'Africa/Tunis', 'Africa/Algiers', 'Africa/Casablanca',
  'Africa/El_Aaiun', 'Africa/Nouakchott', 'Africa/Mogadishu', 'Africa/Djibouti', 'Indian/Comoro',
]);

const MEXICO_AND_CARIBBEAN_ZONES = new Set([
  'America/Tijuana', 'America/Hermosillo', 'America/Mazatlan', 'America/Chihuahua',
  'America/Ciudad_Juarez', 'America/Ojinaga', 'America/Monterrey', 'America/Matamoros',
  'America/Bahia_Banderas', 'America/Mexico_City', 'America/Merida', 'America/Cancun',
  'America/Nassau',
]);

export function isAutoCalculationMethod(raw?: string | null): boolean {
  const key = raw?.trim().toUpperCase() ?? '';
  return key === '' || key === AUTO_CALCULATION_METHOD || key === 'AUTOMATIC';
}

/** True when User.prayerCalculationMethod was never chosen by the user (empty, AUTO, or the sign-up default). */
export function isUnsetStoredCalculationMethod(raw?: string | null): boolean {
  return isAutoCalculationMethod(raw) || raw?.trim().toUpperCase() === LEGACY_COLUMN_DEFAULT;
}

/** Canonical catalog id (e.g. "MAKKAH") of the official method where the coordinates are. */
export function autoCalculationMethodFor(latitude: number, longitude: number): string {
  let zone: string;
  try {
    zone = tzlookup(latitude, longitude);
  } catch {
    return 'MWL';
  }
  const mapped = ZONE_METHOD[zone];
  if (mapped) return mapped;
  if (EGYPTIAN_METHOD_ZONES.has(zone)) return 'EGYPT';
  if (zone.startsWith('America/') && latitude >= 24.5 && !MEXICO_AND_CARIBBEAN_ZONES.has(zone)) return 'ISNA';
  return 'MWL';
}
