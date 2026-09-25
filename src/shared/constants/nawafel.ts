/**
 * Classic daily sunnah rawatib — 12 rak‘ahs in 5 checklist slots.
 * Product v1: track only (no FCM).
 */

export const NAWAFEL_KEYS = [
  'FAJR_BEFORE_2',
  'DHUHR_BEFORE_4',
  'DHUHR_AFTER_2',
  'MAGHRIB_AFTER_2',
  'ISHA_AFTER_2',
] as const;

export type NawafelKeyId = (typeof NAWAFEL_KEYS)[number];

export type NawafelCatalogItem = {
  key: NawafelKeyId;
  rakahs: number;
  sortOrder: number;
  /** Linked fard prayer for UI grouping. */
  linkedPrayer: 'FAJR' | 'DHUHR' | 'MAGHRIB' | 'ISHA';
  position: 'BEFORE' | 'AFTER';
  titleAr: string;
  titleEn: string;
  captionAr: string;
  captionEn: string;
};

export const NAWAFEL_CATALOG: readonly NawafelCatalogItem[] = [
  {
    key: 'FAJR_BEFORE_2',
    rakahs: 2,
    sortOrder: 1,
    linkedPrayer: 'FAJR',
    position: 'BEFORE',
    titleAr: 'سنة الفجر',
    titleEn: 'Fajr sunnah',
    captionAr: 'ركعتان قبل الفجر',
    captionEn: '2 rak‘ahs before Fajr',
  },
  {
    key: 'DHUHR_BEFORE_4',
    rakahs: 4,
    sortOrder: 2,
    linkedPrayer: 'DHUHR',
    position: 'BEFORE',
    titleAr: 'سنة الظهر القبلية',
    titleEn: 'Dhuhr sunnah (before)',
    captionAr: 'أربع ركعات قبل الظهر',
    captionEn: '4 rak‘ahs before Dhuhr',
  },
  {
    key: 'DHUHR_AFTER_2',
    rakahs: 2,
    sortOrder: 3,
    linkedPrayer: 'DHUHR',
    position: 'AFTER',
    titleAr: 'سنة الظهر البعدية',
    titleEn: 'Dhuhr sunnah (after)',
    captionAr: 'ركعتان بعد الظهر',
    captionEn: '2 rak‘ahs after Dhuhr',
  },
  {
    key: 'MAGHRIB_AFTER_2',
    rakahs: 2,
    sortOrder: 4,
    linkedPrayer: 'MAGHRIB',
    position: 'AFTER',
    titleAr: 'سنة المغرب',
    titleEn: 'Maghrib sunnah',
    captionAr: 'ركعتان بعد المغرب',
    captionEn: '2 rak‘ahs after Maghrib',
  },
  {
    key: 'ISHA_AFTER_2',
    rakahs: 2,
    sortOrder: 5,
    linkedPrayer: 'ISHA',
    position: 'AFTER',
    titleAr: 'سنة العشاء',
    titleEn: 'Isha sunnah',
    captionAr: 'ركعتان بعد العشاء',
    captionEn: '2 rak‘ahs after Isha',
  },
] as const;

export const NAWAFEL_TOTAL_RAKAHS = NAWAFEL_CATALOG.reduce((sum, item) => sum + item.rakahs, 0);
export const NAWAFEL_SLOT_COUNT = NAWAFEL_CATALOG.length;

export function isNawafelKey(value: string): value is NawafelKeyId {
  return (NAWAFEL_KEYS as readonly string[]).includes(value);
}

export function getNawafelByKey(key: string): NawafelCatalogItem | undefined {
  return NAWAFEL_CATALOG.find((item) => item.key === key);
}
