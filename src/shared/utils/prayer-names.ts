import { PrayerNameEnum } from '../../utils/constants';

/** Flutter contract uses Title Case English names (e.g. "Asr"), DB uses FAJR…ISHA enums. */
const TITLE_BY_ENUM: Record<PrayerNameEnum, string> = {
  [PrayerNameEnum.FAJR]: 'Fajr',
  [PrayerNameEnum.DHUHR]: 'Dhuhr',
  [PrayerNameEnum.ASR]: 'Asr',
  [PrayerNameEnum.MAGHRIB]: 'Maghrib',
  [PrayerNameEnum.ISHA]: 'Isha',
};

const ENUM_BY_ALIAS: Record<string, PrayerNameEnum> = {
  FAJR: PrayerNameEnum.FAJR,
  FAJAR: PrayerNameEnum.FAJR,
  DHUHR: PrayerNameEnum.DHUHR,
  ZUHR: PrayerNameEnum.DHUHR,
  ZOHR: PrayerNameEnum.DHUHR,
  ASR: PrayerNameEnum.ASR,
  MAGHRIB: PrayerNameEnum.MAGHRIB,
  ISHA: PrayerNameEnum.ISHA,
};

for (const [enumKey, title] of Object.entries(TITLE_BY_ENUM)) {
  ENUM_BY_ALIAS[title.toUpperCase()] = enumKey as PrayerNameEnum;
  ENUM_BY_ALIAS[title] = enumKey as PrayerNameEnum;
  ENUM_BY_ALIAS[title.toLowerCase()] = enumKey as PrayerNameEnum;
  ENUM_BY_ALIAS[enumKey] = enumKey as PrayerNameEnum;
}

export function prayerEnumToTitle(name: PrayerNameEnum | string): string {
  const key = String(name).toUpperCase() as PrayerNameEnum;
  return TITLE_BY_ENUM[key] ?? String(name);
}

export function parsePrayerKey(raw: string): PrayerNameEnum | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (ENUM_BY_ALIAS[upper]) return ENUM_BY_ALIAS[upper];
  if (ENUM_BY_ALIAS[trimmed]) return ENUM_BY_ALIAS[trimmed];
  return null;
}

export function isValidPrayerKey(raw: string): boolean {
  return parsePrayerKey(raw) != null;
}
