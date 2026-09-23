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

export type CalculationMethodOption = {
  /** Canonical short key — use this in PATCH /profile/azan-preferences and query params (e.g. "EGYPT"). */
  id: string;
  /** All accepted aliases (both short+long; normalized by prayer.service.ts resolveCalculationParams. */
  aliases: string[];
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  regionHintEn: string;
  regionHintAr: string;
  /** True when this is the product default (MENA/Egypt-first Noor. */
  isDefault?: boolean;
  sortOrder: number;
};

export type MadhabOption = {
  /** Canonical key — "SHAFI" or "HANAFI". */
  id: 'SHAFI' | 'HANAFI';
  aliases: string[];
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  isDefault?: boolean;
  sortOrder: number;
};

/**
 * Canonical Calculation Methods catalog — authoritative list for Flutter picker dropdown.
 * Short id is the contract key for API & query param & saved short forms all resolve inside prayer.service.ts resolveCalculationParams.
 */
export const CALCULATION_METHODS_CATALOG: CalculationMethodOption[] = [
  {
    id: 'EGYPT',
    aliases: ['EGYPT', 'EGYPTIAN', 'EGYPTIAN_GENERAL_AUTHORITY_OF_SURVEY'],
    nameEn: 'Egyptian General Authority',
    nameAr: 'الهيئة المصرية للمساحة',
    descriptionEn: 'Egyptian General Authority of Survey — standard for Egypt / MENA region (Im region.',
    descriptionAr: 'الهيئة المصرية العامة للمساحة — المعيار لمصر وشمال أفريقيا والشرق الأوسط.',
    regionHintEn: 'Egypt, MENA',
    regionHintAr: 'مصر، الوط العربي، شمال أفريقيا، الشرق الأوسط',
    isDefault: true,
    sortOrder: 1,
  },
  {
    id: 'MWL',
    aliases: ['MWL', 'MUSLIM_WORLD_LEAGUE'],
    nameEn: 'Muslim World League',
    nameAr: 'رابطة العالم الإسلامي',
    descriptionEn: 'Muslim World League — widely used across Europe, Africa, and South East Asia.',
    descriptionAr: 'رابطة العالم الإسلامي — مستخدمة على نطاق واسع في أوروبا وأفريقيا وجنوب شرق آسيا.',
    regionHintEn: 'Global / EU / AF / SEA',
    regionHintAr: 'عالمي / أوروبا / أفريقيا / جنوب شرق آسيا',
    sortOrder: 2,
  },
  {
    id: 'MAKKAH',
    aliases: ['MAKKAH', 'UMM_AL_QURA'],
    nameEn: 'Umm Al-Qura (Makkah)',
    nameAr: 'أم القرى (مكة المكرمة)',
    descriptionEn: 'Umm Al-Qura University — official for Saudi Arabia (Makkah / Madinah).',
    descriptionAr: 'جامعة أم القرى — الطريقة الرسمية للمملكة العربية السعودية.',
    regionHintEn: 'Saudi Arabia, Gulf',
    regionHintAr: 'المملكة العربية السعودية، دول الخليج',
    sortOrder: 3,
  },
  {
    id: 'KARACHI',
    aliases: ['KARACHI'],
    nameEn: 'University of Islamic Sciences, Karachi',
    nameAr: 'جامعة العلوم الإسلامية بكراتشي',
    descriptionEn: 'University of Islamic Sciences Karachi — common in Pakistan, India, and Bangladesh.',
    descriptionAr: 'جامعة العلوم الإسلامية بكراتشي — منتشرة في باكستان والهند وبنجلاديش.',
    regionHintEn: 'PK / IN / BD',
    regionHintAr: 'باكستان، الهند، بنغلاديش',
    sortOrder: 4,
  },
  {
    id: 'ISNA',
    aliases: ['ISNA', 'NORTH_AMERICA'],
    nameEn: 'Islamic Society of North America (ISNA)',
    nameAr: 'الجمعية الإسلامية لشمال أمريكا',
    descriptionEn: 'Islamic Society of North America — recommended for USA and Canada.',
    descriptionAr: 'الجمعية الإسلامية لشمال أمريكا — موصى بها للولايات المتحدة وكندا.',
    regionHintEn: 'USA, Canada',
    regionHintAr: 'الولايات المتحدة، كندا',
    sortOrder: 5,
  },
  {
    id: 'TEHRAN',
    aliases: ['TEHRAN'],
    nameEn: 'Institute of Geophysics, Tehran',
    nameAr: 'معهد الجيوفيزياء بطهران',
    descriptionEn: 'Institute of Geophysics, University of Tehran — mainly used in Iran.',
    descriptionAr: 'معهد الجيوفيزياء بجامعة طهران — مستخدم بشكل أساسي في إيران.',
    regionHintEn: 'Iran',
    regionHintAr: 'إيران',
    sortOrder: 6,
  },
];

/** Canonical Asr Madhabs catalog — authoritative list for Flutter picker dropdown.
 *  Used both in query `madhab` query in GET/PATCH /profile/azan-preferences and query in GET /prayers/today madhab.
 */
export const MADHABS_CATALOG: MadhabOption[] = [
  {
    id: 'SHAFI',
    aliases: ['SHAFI', 'SHAFII', 'SHAFII', 'شافعي'],
    nameEn: 'Shafi (Shafi’i (Earliest shadow = shorter Asr)',
    nameAr: 'الشافعي (وقت مبكر للعصر — الظل مثل الطول)',
    descriptionEn: 'Shafi’i, Maliki & Hanbali — Asr time starts when object shadow length equals the object height + shadow at Dhuhr.',
    descriptionAr: 'مذاهب الشافعي والمالكي والحنبلي — وقت العصر عندما يساوي ظل الشيء طوله مضافًا إلى ظله عند الظهر.',
    isDefault: true,
    sortOrder: 1,
  },
  {
    id: 'HANAFI',
    aliases: ['HANAFI', 'حنفي'],
    nameEn: 'Hanafi (Later Asr = longer shadow)',
    nameAr: 'الحنفي (وقت متأخر للعصر — الظل ضعف الطول)',
    descriptionEn: 'Hanafi madhab — Asr starts when object shadow length equals twice the object height + shadow at Dhuhr.',
    descriptionAr: 'المذهب الحنفي — وقت العصر عندما يساوي ظل الشيء ضعف طوله مضافًا إلى ظله عند الظهر.',
    sortOrder: 2,
  },
];
