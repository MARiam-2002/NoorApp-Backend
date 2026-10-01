/**
 * Default prayer / Azan location before login or before the user saves GPS.
 * Cairo, Egypt. The default method is AUTO: the official method of the user's country
 * (Egyptian General Authority of Survey for Cairo).
 */
export const DEFAULT_PRAYER_LOCATION = {
  city: 'Cairo',
  cityAr: 'القاهرة',
  country: 'Egypt',
  countryAr: 'مصر',
  latitude: 30.0444,
  longitude: 31.2357,
  timezone: 'Africa/Cairo',
  calculationMethod: 'AUTO',
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
    id: 'AUTO',
    aliases: ['AUTO', 'AUTOMATIC'],
    nameEn: 'Automatic (by country)',
    nameAr: 'تلقائي حسب الدولة',
    descriptionEn: "Uses the official method of the country you are in: Umm Al-Qura in Saudi Arabia, the Egyptian Authority in Egypt, the Ministry of Habous in Morocco, the Awqaf ministries in Algeria, Jordan, the UAE and Oman, Diyanet in Turkey, and so on. Follows you when you travel.",
    descriptionAr: 'يستخدم الطريقة الرسمية للدولة الموجود فيها: أم القرى في السعودية، والهيئة المصرية في مصر، ووزارة الأوقاف في المغرب والجزائر والأردن والإمارات وعُمان، وديانت في تركيا، وهكذا. ويتغير تلقائيًا عند السفر.',
    regionHintEn: 'All countries',
    regionHintAr: 'كل الدول',
    isDefault: true,
    sortOrder: 0,
  },
  {
    id: 'EGYPT',
    aliases: ['EGYPT', 'EGYPTIAN', 'EGYPTIAN_GENERAL_AUTHORITY_OF_SURVEY'],
    nameEn: 'Egyptian General Authority',
    nameAr: 'الهيئة المصرية للمساحة',
    descriptionEn: 'Egyptian General Authority of Survey — official for Egypt.',
    descriptionAr: 'الهيئة المصرية العامة للمساحة — الطريقة الرسمية في مصر.',
    regionHintEn: 'Egypt, MENA',
    regionHintAr: 'مصر، الوطن العربي، شمال أفريقيا',
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
  {
    id: 'DUBAI',
    aliases: ['DUBAI', 'UAE'],
    nameEn: 'Dubai (UAE)',
    nameAr: 'دبي (الإمارات)',
    descriptionEn: 'General Authority of Islamic Affairs & Endowments (Awqaf) — official for the United Arab Emirates (Fajr 18.2°, Isha 18.2°).',
    descriptionAr: 'الهيئة العامة للشؤون الإسلامية والأوقاف — الطريقة الرسمية في دولة الإمارات (الفجر 18.2° والعشاء 18.2°).',
    regionHintEn: 'UAE',
    regionHintAr: 'الإمارات',
    sortOrder: 7,
  },
  {
    id: 'QATAR',
    aliases: ['QATAR'],
    nameEn: 'Qatar',
    nameAr: 'قطر',
    descriptionEn: 'Umm Al-Qura variant with standard Fajr angle — used in Qatar.',
    descriptionAr: 'نسخة معدلة من أم القرى بزاوية فجر قياسية — مستخدمة في قطر.',
    regionHintEn: 'Qatar',
    regionHintAr: 'قطر',
    sortOrder: 8,
  },
  {
    id: 'KUWAIT',
    aliases: ['KUWAIT'],
    nameEn: 'Kuwait',
    nameAr: 'الكويت',
    descriptionEn: 'Method used by the Ministry of Awqaf in Kuwait.',
    descriptionAr: 'الطريقة المعتمدة من وزارة الأوقاف الكويتية.',
    regionHintEn: 'Kuwait',
    regionHintAr: 'الكويت',
    sortOrder: 9,
  },
  {
    id: 'TURKEY',
    aliases: ['TURKEY', 'DIYANET'],
    nameEn: 'Diyanet (Turkey)',
    nameAr: 'رئاسة الشؤون الدينية (تركيا)',
    descriptionEn: 'Presidency of Religious Affairs (Diyanet) — official for Turkey.',
    descriptionAr: 'رئاسة الشؤون الدينية التركية (ديانت) — الطريقة الرسمية في تركيا.',
    regionHintEn: 'Turkey',
    regionHintAr: 'تركيا',
    sortOrder: 10,
  },
  {
    id: 'SINGAPORE',
    aliases: ['SINGAPORE', 'MUIS', 'JAKIM', 'MALAYSIA'],
    nameEn: 'MUIS / JAKIM (Singapore, Malaysia)',
    nameAr: 'سنغافورة وماليزيا (MUIS / JAKIM)',
    descriptionEn: 'Used in Singapore, Malaysia and Brunei.',
    descriptionAr: 'مستخدمة في سنغافورة وماليزيا وبروناي.',
    regionHintEn: 'Singapore, Malaysia, Brunei',
    regionHintAr: 'سنغافورة، ماليزيا، بروناي',
    sortOrder: 11,
  },
  {
    id: 'KEMENAG',
    aliases: ['KEMENAG', 'INDONESIA'],
    nameEn: 'Kemenag (Indonesia)',
    nameAr: 'وزارة الشؤون الدينية (إندونيسيا)',
    descriptionEn: 'Ministry of Religious Affairs — official for Indonesia (Fajr 20°, Isha 18°).',
    descriptionAr: 'وزارة الشؤون الدينية الإندونيسية — الفجر 20° والعشاء 18°.',
    regionHintEn: 'Indonesia',
    regionHintAr: 'إندونيسيا',
    sortOrder: 12,
  },
  {
    id: 'UOIF',
    aliases: ['UOIF', 'FRANCE'],
    nameEn: 'UOIF (France)',
    nameAr: 'اتحاد المنظمات الإسلامية (فرنسا)',
    descriptionEn: 'Union des Organisations Islamiques de France — Fajr 12°, Isha 12°.',
    descriptionAr: 'اتحاد المنظمات الإسلامية في فرنسا — الفجر 12° والعشاء 12°.',
    regionHintEn: 'France',
    regionHintAr: 'فرنسا',
    sortOrder: 13,
  },
  {
    id: 'MOONSIGHTING',
    aliases: ['MOONSIGHTING', 'MOONSIGHTING_COMMITTEE'],
    nameEn: 'Moonsighting Committee Worldwide',
    nameAr: 'لجنة رؤية الهلال العالمية',
    descriptionEn: 'Seasonal twilight adjustments — popular in the UK, USA and Canada, good at high latitudes.',
    descriptionAr: 'تعديلات موسمية للشفق — منتشرة في بريطانيا وأمريكا وكندا ومناسبة للمناطق الشمالية.',
    regionHintEn: 'UK, North America, high latitudes',
    regionHintAr: 'بريطانيا، أمريكا الشمالية، المناطق الشمالية',
    sortOrder: 14,
  },
  {
    id: 'MOROCCO',
    aliases: ['MOROCCO', 'HABOUS'],
    nameEn: 'Ministry of Habous (Morocco)',
    nameAr: 'وزارة الأوقاف والشؤون الإسلامية (المغرب)',
    descriptionEn: 'Ministry of Habous and Islamic Affairs — official for Morocco (Fajr 19°, Isha 17°).',
    descriptionAr: 'وزارة الأوقاف والشؤون الإسلامية المغربية — الفجر 19° والعشاء 17°.',
    regionHintEn: 'Morocco',
    regionHintAr: 'المغرب',
    sortOrder: 15,
  },
  {
    id: 'ALGERIA',
    aliases: ['ALGERIA'],
    nameEn: 'Ministry of Religious Affairs (Algeria)',
    nameAr: 'وزارة الشؤون الدينية والأوقاف (الجزائر)',
    descriptionEn: 'Ministry of Religious Affairs and Endowments — official for Algeria (Fajr 18°, Isha 17°).',
    descriptionAr: 'وزارة الشؤون الدينية والأوقاف الجزائرية — الفجر 18° والعشاء 17°.',
    regionHintEn: 'Algeria',
    regionHintAr: 'الجزائر',
    sortOrder: 16,
  },
  {
    id: 'TUNISIA',
    aliases: ['TUNISIA'],
    nameEn: 'Tunisia',
    nameAr: 'تونس',
    descriptionEn: 'Method used for Tunisia (Fajr 18°, Isha 18°).',
    descriptionAr: 'الطريقة المستخدمة في تونس — الفجر 18° والعشاء 18°.',
    regionHintEn: 'Tunisia',
    regionHintAr: 'تونس',
    sortOrder: 17,
  },
  {
    id: 'JORDAN',
    aliases: ['JORDAN'],
    nameEn: 'Ministry of Awqaf (Jordan)',
    nameAr: 'وزارة الأوقاف (الأردن)',
    descriptionEn: 'Ministry of Awqaf and Islamic Affairs — official for Jordan and the Jerusalem Awqaf (Fajr 18°, Isha 18°).',
    descriptionAr: 'وزارة الأوقاف والشؤون والمقدسات الإسلامية الأردنية — للأردن وأوقاف القدس (الفجر 18° والعشاء 18°).',
    regionHintEn: 'Jordan, Palestine',
    regionHintAr: 'الأردن، فلسطين',
    sortOrder: 18,
  },
  {
    id: 'OMAN',
    aliases: ['OMAN'],
    nameEn: 'Ministry of Awqaf (Oman)',
    nameAr: 'وزارة الأوقاف والشؤون الدينية (عُمان)',
    descriptionEn: 'Ministry of Endowments and Religious Affairs — official for Oman (Fajr 18°, Isha 18°).',
    descriptionAr: 'وزارة الأوقاف والشؤون الدينية العُمانية — الفجر 18° والعشاء 18°.',
    regionHintEn: 'Oman',
    regionHintAr: 'عُمان',
    sortOrder: 19,
  },
  {
    id: 'BAHRAIN',
    aliases: ['BAHRAIN'],
    nameEn: 'Bahrain',
    nameAr: 'البحرين',
    descriptionEn: 'Method used for Bahrain (Fajr 18°, Isha 18°).',
    descriptionAr: 'الطريقة المستخدمة في البحرين — الفجر 18° والعشاء 18°.',
    regionHintEn: 'Bahrain',
    regionHintAr: 'البحرين',
    sortOrder: 20,
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
