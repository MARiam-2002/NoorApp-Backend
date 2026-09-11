/**
 * Personal Sadaqah tracking constants (no payments / gateways).
 * Matches the Flutter Sadaqah screen categories.
 */

export const DEFAULT_SADAQAH_GOAL_EGP = 1000;
export const SADAQAH_CURRENCY = 'EGP' as const;
export const SADAQAH_CURRENCY_LABEL_AR = 'جنيه';
export const SADAQAH_CURRENCY_LABEL_EN = 'EGP';

export const SADAQAH_CATEGORY_IDS = [
  'FOOD',
  'CLOTHES',
  'EDUCATION',
  'MONEY',
  'GENERAL',
] as const;

export type SadaqahCategoryId = (typeof SADAQAH_CATEGORY_IDS)[number];

export type SadaqahCategoryOption = {
  id: SadaqahCategoryId;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  iconCode: string;
};

/** Static donation-type options for personal tracking UI (not payment rails). */
export const SADAQAH_CATEGORIES: SadaqahCategoryOption[] = [
  {
    id: 'FOOD',
    nameAr: 'وجبات طعام',
    nameEn: 'Food meals',
    descriptionAr: 'اطعام المحتاجين',
    descriptionEn: 'Feeding those in need',
    iconCode: 'food',
  },
  {
    id: 'CLOTHES',
    nameAr: 'ملابس',
    nameEn: 'Clothes',
    descriptionAr: 'لمن هم بحاجة',
    descriptionEn: 'For those in need',
    iconCode: 'clothes',
  },
  {
    id: 'EDUCATION',
    nameAr: 'تعليم',
    nameEn: 'Education',
    descriptionAr: 'لبناء مستقبل أفضل',
    descriptionEn: 'To build a better future',
    iconCode: 'education',
  },
  {
    id: 'MONEY',
    nameAr: 'تبرع بمال',
    nameEn: 'Donate money',
    descriptionAr: 'بمبلغ تختاره',
    descriptionEn: 'With an amount you choose',
    iconCode: 'money',
  },
  {
    id: 'GENERAL',
    nameAr: 'صدقة عامة',
    nameEn: 'General sadaqah',
    descriptionAr: 'أي صدقة تسجلها اليوم',
    descriptionEn: 'Any sadaqah you record today',
    iconCode: 'general',
  },
];

export function isSadaqahCategoryId(value: unknown): value is SadaqahCategoryId {
  return (
    typeof value === 'string' &&
    (SADAQAH_CATEGORY_IDS as readonly string[]).includes(value.toUpperCase())
  );
}

export function normalizeSadaqahCategoryId(
  value?: string | null,
): SadaqahCategoryId | undefined {
  if (!value?.trim()) return undefined;
  const key = value.trim().toUpperCase();
  return isSadaqahCategoryId(key) ? key : undefined;
}

export function sadaqahProgressPercent(amount: number, goal = DEFAULT_SADAQAH_GOAL_EGP): number {
  if (goal <= 0) return 0;
  return Math.min(100, Math.round((Math.max(0, amount) / goal) * 100));
}

/** Featured banner on the Sadaqah screen (static copy — not a payment CTA). */
export const SADAQAH_FEATURED_BANNER = {
  titleAr: 'اطعم محتاجا',
  titleEn: 'Feed someone in need',
  descriptionAr: 'يمكنك التبرع بوجبة طعام او بمبلغ بسيط',
  descriptionEn: 'You can record a meal or a small amount as personal sadaqah',
  categoryId: 'FOOD' as SadaqahCategoryId,
};

export const SADAQAH_GOAL_CAPTION_AR = 'كل جنيه صدقة يصنع فرقا';
export const SADAQAH_GOAL_CAPTION_EN = 'Every pound of sadaqah makes a difference';
export const SADAQAH_TRACKING_ONLY_NOTE_EN =
  'Personal sadaqah tracking only. No payments, gateways, or money transfer.';
