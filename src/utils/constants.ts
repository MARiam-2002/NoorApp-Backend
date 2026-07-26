export const DefaultTimezone = 'Africa/Cairo';

export enum PrayerNameEnum {
  FAJR = 'FAJR',
  DHUHR = 'DHUHR',
  ASR = 'ASR',
  MAGHRIB = 'MAGHRIB',
  ISHA = 'ISHA',
}

export const PrayerOrder = [
  PrayerNameEnum.FAJR,
  PrayerNameEnum.DHUHR,
  PrayerNameEnum.ASR,
  PrayerNameEnum.MAGHRIB,
  PrayerNameEnum.ISHA,
];
