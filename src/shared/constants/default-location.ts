/**
 * Default prayer / Azan location before login or before the user saves GPS.
 * Cairo, Egypt — Egyptian General Authority of Survey method.
 */
export const DEFAULT_PRAYER_LOCATION = {
  city: 'Cairo',
  cityAr: 'القاهرة',
  country: 'Egypt',
  countryAr: 'مصر',
  latitude: 30.0444,
  longitude: 31.2357,
  timezone: 'Africa/Cairo',
  calculationMethod: 'EGYPT',
  calculationMethodLabel: 'EGYPTIAN_GENERAL_AUTHORITY_OF_SURVEY',
  madhab: 'SHAFI',
  locationSource: 'default_cairo' as const,
} as const;

export type PrayerLocationSource = 'default_cairo' | 'query' | 'profile';

export const DEFAULT_LATITUDE = DEFAULT_PRAYER_LOCATION.latitude;
export const DEFAULT_LONGITUDE = DEFAULT_PRAYER_LOCATION.longitude;
export const DEFAULT_PRAYER_TIMEZONE = DEFAULT_PRAYER_LOCATION.timezone;
