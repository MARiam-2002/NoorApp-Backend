export enum PrayerNameEnum {
  FAJR = 'FAJR',
  DHUHR = 'DHUHR',
  ASR = 'ASR',
  MAGHRIB = 'MAGHRIB',
  ISHA = 'ISHA',
}

export const PrayerLabelsAr: Record<PrayerNameEnum, string> = {
  [PrayerNameEnum.FAJR]: 'الفجر',
  [PrayerNameEnum.DHUHR]: 'الظهر',
  [PrayerNameEnum.ASR]: 'العصر',
  [PrayerNameEnum.MAGHRIB]: 'المغرب',
  [PrayerNameEnum.ISHA]: 'العشاء',
};

export const PrayerOrder: PrayerNameEnum[] = [
  PrayerNameEnum.FAJR,
  PrayerNameEnum.DHUHR,
  PrayerNameEnum.ASR,
  PrayerNameEnum.MAGHRIB,
  PrayerNameEnum.ISHA,
];
