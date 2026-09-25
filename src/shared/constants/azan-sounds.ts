/**
 * Azan + notification catalogs for Noor App.
 *
 * Azan sources (mirrored under /api/v1/azan/media for reliable playback):
 * - AlAdhan / Islamic Network (Mishary Alafasy a4/a7/a9)
 * - Assabile Adhan catalog (https://www.assabile.com/adhan-call-prayer)
 *   for labeled famous muezzin Adhans with working direct MP3 URLs
 *
 * Quran recitation remains separate: /quran/audio (Quran Foundation).
 * Notification tones remain self-hosted Freesound (unchanged).
 */

export type AudioLicense = {
  spdxOrName: 'CC0-1.0' | 'CC-BY-SA-4.0' | 'CC-BY-SA-3.0' | 'CC-BY-4.0' | 'CC-BY-3.0' | 'none';
  licenseUrl: string | null;
  attributionRequired: boolean;
  attributionText: string;
  commercialUseAllowed: boolean;
  sourcePageUrl: string;
};

export type AzanSoundOption = {
  id: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  muezzin: string;
  muezzinEn: string;
  muezzinAr: string;
  locationEn?: string;
  locationAr?: string;
  isFamousVoice: boolean;
  category: 'famous_contemporary' | 'famous_classic';
  /** Absolute stream URL (filled at runtime from /azan/media). */
  audioUrl: string;
  previewUrl: string;
  mediaFile: string;
  format: 'mp3';
  provider: 'aladhan_selfhosted' | 'assabile_selfhosted' | 'soundcloud_reference';
  source: string;
  /** True when HTTP-tested and listed in the live catalog. */
  available: boolean;
  license: AudioLicense;
  streamingAllowed: boolean;
  selfHostingAllowed: boolean;
  commercialUseAllowed: boolean;
  durationSeconds: number | null;
  isDefault?: boolean;
};

export type NotificationSoundOption = {
  id: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  audioUrl: string | null;
  previewUrl: string | null;
  mediaFile: string | null;
  format: 'mp3' | 'none';
  provider: 'freesound_selfhosted' | 'none' | 'soundcloud_reference';
  source: string;
  license: AudioLicense;
  streamingAllowed: boolean;
  selfHostingAllowed: boolean;
  commercialUseAllowed: boolean;
  durationSeconds: number | null;
  mood: 'calm' | 'gentle' | 'soft_bell' | 'silent' | 'prayer_specific_voice';
  matchesPrayer?: string | null;
  isAutoSentinel?: boolean;
  isDefault?: boolean;
};

const aladhanLicense = (recordingTitle: string): AudioLicense => ({
  spdxOrName: 'none',
  licenseUrl: null,
  attributionRequired: true,
  attributionText: `${recordingTitle} — sourced from AlAdhan / Islamic Network (https://aladhan.com/download-adhans), mirrored by Noor for reliable playback. Mu’adhin performance rights remain with the reciter.`,
  commercialUseAllowed: true,
  sourcePageUrl: 'https://aladhan.com/download-adhans',
});

const assabileLicense = (recordingTitle: string): AudioLicense => ({
  spdxOrName: 'none',
  licenseUrl: null,
  attributionRequired: true,
  attributionText: `${recordingTitle} — sourced from Assabile Adhan catalog (https://www.assabile.com/adhan-call-prayer), mirrored by Noor for reliable playback. Mu’adhin performance rights remain with the reciter.`,
  commercialUseAllowed: true,
  sourcePageUrl: 'https://www.assabile.com/adhan-call-prayer',
});

/**
 * Priority famous voices requested for Noor.
 * Only entries with a verified working Adhan stream are in AZAN_SOUND_OPTIONS.
 */
export const FAMOUS_AZAN_VOICE_AUDIT = [
  {
    nameEn: 'Ali Ahmed Mulla',
    nameAr: 'علي أحمد ملا',
    status: 'available',
    reason:
      'Assabile labeled Adhan (Ali Ibn Ahmad Mala — Masjid Al-Haram). HTTP 206 audio/mpeg verified; mirrored under /azan/media/ali_mulla.mp3.',
  },
  {
    nameEn: 'Yasser Al-Dosari',
    nameAr: 'ياسر الدوسري',
    status: 'available',
    reason:
      'Assabile labeled Adhan (Yasser Al-Dosari — Saudi). HTTP 206 audio/mpeg verified; mirrored under /azan/media/yasser_al_dosari.mp3.',
  },
  {
    nameEn: 'Mishary Rashid Alafasy',
    nameAr: 'مشاري راشد العفاسي',
    status: 'available',
    reason:
      'Three AlAdhan Adhans (a4, a7, a9) mirrored under /azan/media (CDN can 502).',
  },
  {
    nameEn: 'Bandar Baleela',
    nameAr: 'بندر بليلة',
    status: 'unavailable',
    reason:
      'Not listed with a labeled Adhan on AlAdhan or Assabile Adhan catalog; no other reputable direct Adhan stream verified.',
  },
  {
    nameEn: 'Maher Al-Muaiqly',
    nameAr: 'ماهر المعيقلي',
    status: 'unavailable',
    reason:
      'Not listed with a labeled Adhan on AlAdhan or Assabile; available Quran recitation sources are not Adhan.',
  },
  {
    nameEn: 'Nasser Al-Qatami',
    nameAr: 'ناصر القطامي',
    status: 'available',
    reason:
      'Assabile labeled Adhan (Nasser Al Qatami — Riyadh). HTTP 206 audio/mpeg verified; mirrored under /azan/media/nasser_al_qatami.mp3.',
  },
  {
    nameEn: 'Abdul Rahman Al-Sudais',
    nameAr: 'عبد الرحمن السديس',
    status: 'unavailable',
    reason:
      'No labeled Adhan stream found on AlAdhan/Assabile; Archive Haram packs list Sudais Quran/witr, not a clear Adhan identity file we can trust.',
  },
  {
    nameEn: 'Ahmed Al-Ajmi',
    nameAr: 'أحمد العجمي',
    status: 'unavailable',
    reason: 'No labeled Adhan stream found on AlAdhan or Assabile Adhan catalog.',
  },
  {
    nameEn: 'Saad Al-Ghamdi',
    nameAr: 'سعد الغامدي',
    status: 'unavailable',
    reason: 'No labeled Adhan stream found on AlAdhan or Assabile Adhan catalog.',
  },
  {
    nameEn: 'Nasr El-Din ToubAr',
    nameAr: 'نصر الدين طوبار',
    status: 'unavailable',
    reason: 'No labeled Adhan stream found on AlAdhan or Assabile Adhan catalog.',
  },
  {
    nameEn: 'Mohamed Rifaat',
    nameAr: 'محمد رفعت',
    status: 'available',
    reason:
      'Assabile labeled Adhan (Muhammad Refaat — Cairo). HTTP 206 audio/mpeg verified; mirrored under /azan/media/mohamed_rifaat.mp3.',
  },
  {
    nameEn: 'Abdul Basit Abdul Samad',
    nameAr: 'عبد الباسط عبد الصمد',
    status: 'available',
    reason:
      'Assabile labeled Adhan (Abdulbasit Abdusamad — Fajr Egypt). HTTP 206 audio/mpeg verified; mirrored under /azan/media/abdul_basit.mp3.',
  },
  {
    nameEn: 'Mohamed Siddiq El-Minshawi',
    nameAr: 'محمد صديق المنشاوي',
    status: 'available',
    reason:
      'Assabile labeled Adhan (Mohamed Siddiq El-Minshawi — Egypt). HTTP 206 audio/mpeg verified; mirrored under /azan/media/mohamed_minshawi.mp3.',
  },
  {
    nameEn: 'Taha El-Fashny',
    nameAr: 'طه الفشني',
    status: 'unavailable',
    reason: 'No labeled Adhan stream found on AlAdhan or Assabile Adhan catalog.',
  },
  {
    nameEn: 'Mohamed Imran',
    nameAr: 'محمد عمران',
    status: 'unavailable',
    reason: 'No labeled Adhan stream found on AlAdhan or Assabile Adhan catalog.',
  },
] as const;

const ALAFASY = {
  muezzin: 'Mishary Rashid Alafasy',
  muezzinEn: 'Mishary Rashid Alafasy',
  muezzinAr: 'مشاري راشد العفاسي',
} as const;

/**
 * Live Azan catalog — verified famous muezzin Adhans only.
 * Mirrored under /azan/media for reliable Flutter playback.
 */
export const AZAN_SOUND_OPTIONS: AzanSoundOption[] = [
  {
    id: 'mishary_alafasy',
    nameEn: 'Mishary Alafasy',
    nameAr: 'مشاري العفاسي',
    descriptionEn:
      'Popular contemporary Islamic voice — Dubai One TV Adhan (clean MP3, reliable Noor stream).',
    descriptionAr: 'صوت إسلامي معاصر محبوب — أذان قناة دبي ون (ملف نظيف عبر بث موثوق من نور).',
    ...ALAFASY,
    locationEn: 'Contemporary Gulf voice',
    locationAr: 'صوت خليجي معاصر',
    isFamousVoice: true,
    available: true,
    category: 'famous_contemporary',
    audioUrl: '',
    previewUrl: '',
    mediaFile: 'mishary_alafasy.mp3',
    format: 'mp3',
    provider: 'aladhan_selfhosted',
    source: 'AlAdhan — Adhan from Dubai\'s One TV by Mishary Rashid Alafasy (mirrored)',
    isDefault: true,
    durationSeconds: null,
    license: aladhanLicense('Adhan from Dubai\'s One TV by Mishary Rashid Alafasy'),
    streamingAllowed: true,
    selfHostingAllowed: true,
    commercialUseAllowed: true,
  },
  {
    id: 'mishary_alafasy_2',
    nameEn: 'Mishary Alafasy (Variant 2)',
    nameAr: 'مشاري العفاسي (نسخة ٢)',
    descriptionEn: 'Another authentic high-quality Adhan by Mishary Rashid Alafasy.',
    descriptionAr: 'أذان أصيل عالي الجودة بصوت مشاري راشد العفاسي (نسخة أخرى).',
    ...ALAFASY,
    locationEn: 'Contemporary Gulf voice',
    locationAr: 'صوت خليجي معاصر',
    isFamousVoice: true,
    available: true,
    category: 'famous_contemporary',
    audioUrl: '',
    previewUrl: '',
    mediaFile: 'mishary_alafasy_2.mp3',
    format: 'mp3',
    provider: 'aladhan_selfhosted',
    source: 'AlAdhan — Another Adhan by Mishary Rashid Alafasy (mirrored)',
    durationSeconds: null,
    license: aladhanLicense('Another Adhan by Mishary Rashid Alafasy'),
    streamingAllowed: true,
    selfHostingAllowed: true,
    commercialUseAllowed: true,
  },
  {
    id: 'mishary_alafasy_3',
    nameEn: 'Mishary Alafasy (Variant 3)',
    nameAr: 'مشاري العفاسي (نسخة ٣)',
    descriptionEn: 'Yet another beloved Adhan performance by Mishary Rashid Alafasy.',
    descriptionAr: 'أداء أذان محبوب آخر بصوت مشاري راشد العفاسي.',
    ...ALAFASY,
    locationEn: 'Contemporary Gulf voice',
    locationAr: 'صوت خليجي معاصر',
    isFamousVoice: true,
    available: true,
    category: 'famous_contemporary',
    audioUrl: '',
    previewUrl: '',
    mediaFile: 'mishary_alafasy_3.mp3',
    format: 'mp3',
    provider: 'aladhan_selfhosted',
    source: 'AlAdhan — Yet Another Adhan by Mishary Rashid Alafasy (mirrored)',
    durationSeconds: null,
    license: aladhanLicense('Yet Another Adhan by Mishary Rashid Alafasy'),
    streamingAllowed: true,
    selfHostingAllowed: true,
    commercialUseAllowed: true,
  },
  {
    id: 'ali_mulla',
    nameEn: 'Ali Ahmed Mulla',
    nameAr: 'علي أحمد ملا',
    descriptionEn: 'Famous voice of Masjid Al-Haram — classic Makkah Adhan.',
    descriptionAr: 'صوت مشهور من المسجد الحرام — أذان مكة المكرمة.',
    muezzin: 'Ali Ahmed Mulla',
    muezzinEn: 'Ali Ahmed Mulla',
    muezzinAr: 'علي أحمد ملا',
    locationEn: 'Masjid Al-Haram, Makkah',
    locationAr: 'المسجد الحرام، مكة المكرمة',
    isFamousVoice: true,
    available: true,
    category: 'famous_contemporary',
    audioUrl: '',
    previewUrl: '',
    mediaFile: 'ali_mulla.mp3',
    format: 'mp3',
    provider: 'assabile_selfhosted',
    source: 'Assabile — Ali Ibn Ahmad Mala Adhan Al Haram Al Makee (mirrored)',
    durationSeconds: 246,
    license: assabileLicense('Ali Ibn Ahmad Mala - Adhan Al Haram Al Makee'),
    streamingAllowed: true,
    selfHostingAllowed: true,
    commercialUseAllowed: true,
  },
  {
    id: 'yasser_al_dosari',
    nameEn: 'Yasser Al-Dosari',
    nameAr: 'ياسر الدوسري',
    descriptionEn: 'Very popular contemporary Saudi voice — beloved modern Adhan.',
    descriptionAr: 'صوت سعودي معاصر محبوب جدًا — أذان حديث جميل.',
    muezzin: 'Yasser Al-Dosari',
    muezzinEn: 'Yasser Al-Dosari',
    muezzinAr: 'ياسر الدوسري',
    locationEn: 'Saudi Arabia',
    locationAr: 'المملكة العربية السعودية',
    isFamousVoice: true,
    available: true,
    category: 'famous_contemporary',
    audioUrl: '',
    previewUrl: '',
    mediaFile: 'yasser_al_dosari.mp3',
    format: 'mp3',
    provider: 'assabile_selfhosted',
    source: 'Assabile — Yasser Al-Dosari Adhan Al Saoudea (mirrored)',
    durationSeconds: 182,
    license: assabileLicense('Yasser Al-Dosari - Adhan Al Saoudea'),
    streamingAllowed: true,
    selfHostingAllowed: true,
    commercialUseAllowed: true,
  },
  {
    id: 'nasser_al_qatami',
    nameEn: 'Nasser Al-Qatami',
    nameAr: 'ناصر القطامي',
    descriptionEn: 'Recognizable contemporary Saudi voice — Riyadh Adhan.',
    descriptionAr: 'صوت سعودي معاصر معروف — أذان الرياض.',
    muezzin: 'Nasser Al-Qatami',
    muezzinEn: 'Nasser Al-Qatami',
    muezzinAr: 'ناصر القطامي',
    locationEn: 'Riyadh, Saudi Arabia',
    locationAr: 'الرياض، المملكة العربية السعودية',
    isFamousVoice: true,
    available: true,
    category: 'famous_contemporary',
    audioUrl: '',
    previewUrl: '',
    mediaFile: 'nasser_al_qatami.mp3',
    format: 'mp3',
    provider: 'assabile_selfhosted',
    source: 'Assabile — Nasser Al Qatami Adhan Al Riad (mirrored)',
    durationSeconds: 135,
    license: assabileLicense('Nasser Al Qatami - Adhan Al Riad Al Saoudea'),
    streamingAllowed: true,
    selfHostingAllowed: true,
    commercialUseAllowed: true,
  },
  {
    id: 'abdul_basit',
    nameEn: 'Abdul Basit Abdul Samad',
    nameAr: 'عبد الباسط عبد الصمد',
    descriptionEn: 'World-famous Egyptian voice — Fajr Adhan (Egypt).',
    descriptionAr: 'صوت مصري عالمي الشهرة — أذان الفجر (مصر).',
    muezzin: 'Abdul Basit Abdul Samad',
    muezzinEn: 'Abdul Basit Abdul Samad',
    muezzinAr: 'عبد الباسط عبد الصمد',
    locationEn: 'Egypt',
    locationAr: 'مصر',
    isFamousVoice: true,
    available: true,
    category: 'famous_classic',
    audioUrl: '',
    previewUrl: '',
    mediaFile: 'abdul_basit.mp3',
    format: 'mp3',
    provider: 'assabile_selfhosted',
    source: 'Assabile — Abdulbasit Abdusamad Adhan Al Fajr Messr (mirrored)',
    durationSeconds: 293,
    license: assabileLicense('Abdulbasit Abdusamad - Adhan Al Fajr, Messr'),
    streamingAllowed: true,
    selfHostingAllowed: true,
    commercialUseAllowed: true,
  },
  {
    id: 'mohamed_minshawi',
    nameEn: 'Mohamed Siddiq El-Minshawi',
    nameAr: 'محمد صديق المنشاوي',
    descriptionEn: 'Beloved classic Egyptian voice — Egypt Adhan.',
    descriptionAr: 'صوت مصري كلاسيكي محبوب — أذان مصر.',
    muezzin: 'Mohamed Siddiq El-Minshawi',
    muezzinEn: 'Mohamed Siddiq El-Minshawi',
    muezzinAr: 'محمد صديق المنشاوي',
    locationEn: 'Egypt',
    locationAr: 'مصر',
    isFamousVoice: true,
    available: true,
    category: 'famous_classic',
    audioUrl: '',
    previewUrl: '',
    mediaFile: 'mohamed_minshawi.mp3',
    format: 'mp3',
    provider: 'assabile_selfhosted',
    source: 'Assabile — Mohamed Siddiq El-Minshawi Adhan Messr (mirrored)',
    durationSeconds: 251,
    license: assabileLicense('Mohamed Siddiq El-Minshawi - Adhan, Messr'),
    streamingAllowed: true,
    selfHostingAllowed: true,
    commercialUseAllowed: true,
  },
  {
    id: 'mohamed_rifaat',
    nameEn: 'Mohamed Rifaat',
    nameAr: 'محمد رفعت',
    descriptionEn: 'Historic famous Egyptian Adhan voice — Cairo.',
    descriptionAr: 'صوت أذان مصري تاريخي مشهور — القاهرة.',
    muezzin: 'Mohamed Rifaat',
    muezzinEn: 'Mohamed Rifaat',
    muezzinAr: 'محمد رفعت',
    locationEn: 'Cairo, Egypt',
    locationAr: 'القاهرة، مصر',
    isFamousVoice: true,
    available: true,
    category: 'famous_classic',
    audioUrl: '',
    previewUrl: '',
    mediaFile: 'mohamed_rifaat.mp3',
    format: 'mp3',
    provider: 'assabile_selfhosted',
    source: 'Assabile — Muhammad Refaat Adhan Al Qahera (mirrored)',
    durationSeconds: 203,
    license: assabileLicense('Muhammad Refaat - Adhan Al Qahera, Messr'),
    streamingAllowed: true,
    selfHostingAllowed: true,
    commercialUseAllowed: true,
  },
];

/**
 * Calm, spiritual notification tones for an Islamic / Qur’an app.
 * Unchanged — not Azan voices.
 */
export const NOTIFICATION_SOUND_OPTIONS: NotificationSoundOption[] = [
  {
    id: 'soft_chime',
    nameEn: 'Very Soft Notification',
    nameAr: 'تنبيه ناعم جدًا',
    descriptionEn: 'Shortest, least intrusive reminder — recommended default.',
    descriptionAr: 'أقصر تنبيه وأقله إزعاجًا — الخيار الافتراضي الموصى به.',
    audioUrl: '',
    previewUrl: '',
    mediaFile: 'soft_chime.mp3',
    format: 'mp3',
    provider: 'freesound_selfhosted',
    source: 'Freesound',
    isDefault: true,
    mood: 'calm',
    durationSeconds: null,
    license: {
      spdxOrName: 'CC0-1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      attributionRequired: false,
      attributionText:
        'Notification Sound 1 by deadrobotmusic (Freesound), CC0 1.0 — https://freesound.org/s/750607/',
      commercialUseAllowed: true,
      sourcePageUrl: 'https://freesound.org/people/deadrobotmusic/sounds/750607/',
    },
    streamingAllowed: true,
    selfHostingAllowed: true,
    commercialUseAllowed: true,
  },
  {
    id: 'meditation_bell',
    nameEn: 'Prayer Reminder',
    nameAr: 'تذكير بالصلاة',
    descriptionEn: 'Soft meditation bell — calm spiritual reminder.',
    descriptionAr: 'جرس تأملي ناعم — تذكير روحاني هادئ.',
    audioUrl: '',
    previewUrl: '',
    mediaFile: 'meditation_bell.mp3',
    format: 'mp3',
    provider: 'freesound_selfhosted',
    source: 'Freesound',
    mood: 'gentle',
    durationSeconds: null,
    license: {
      spdxOrName: 'CC0-1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      attributionRequired: false,
      attributionText:
        'bell-meditation_cleaned.wav by JetRye (Freesound), CC0 1.0 — https://freesound.org/s/140128/',
      commercialUseAllowed: true,
      sourcePageUrl: 'https://freesound.org/people/JetRye/sounds/140128/',
    },
    streamingAllowed: true,
    selfHostingAllowed: true,
    commercialUseAllowed: true,
  },
  {
    id: 'singing_bowl',
    nameEn: 'Calm Reminder',
    nameAr: 'تذكير هادئ',
    descriptionEn: 'Soft singing-bowl hit — peaceful Dhikr / reminder tone.',
    descriptionAr: 'ضربة ناعمة لوعاء غنائي — نغمة تذكير/ذكر هادئة.',
    audioUrl: '',
    previewUrl: '',
    mediaFile: 'singing_bowl.mp3',
    format: 'mp3',
    provider: 'freesound_selfhosted',
    source: 'Freesound',
    mood: 'gentle',
    durationSeconds: null,
    license: {
      spdxOrName: 'CC0-1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      attributionRequired: false,
      attributionText:
        'Singing Bowl - Soft Stick Meditative Hit by Rimych (Freesound), CC0 1.0 — https://freesound.org/s/616335/',
      commercialUseAllowed: true,
      sourcePageUrl: 'https://freesound.org/people/Rimych/sounds/616335/',
    },
    streamingAllowed: true,
    selfHostingAllowed: true,
    commercialUseAllowed: true,
  },
  {
    id: 'xylophone_chime',
    nameEn: 'Gentle Spiritual Chime',
    nameAr: 'نغمة روحانية لطيفة',
    descriptionEn: 'Soft xylophone-style chime for pre-reminders.',
    descriptionAr: 'نغمة إكسيليفون ناعمة للتذكير المسبق.',
    audioUrl: '',
    previewUrl: '',
    mediaFile: 'xylophone_chime.mp3',
    format: 'mp3',
    provider: 'freesound_selfhosted',
    source: 'Freesound',
    mood: 'gentle',
    durationSeconds: null,
    license: {
      spdxOrName: 'CC0-1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      attributionRequired: false,
      attributionText:
        'notify3.wav by Mihacappy (Freesound), CC0 1.0 — https://freesound.org/s/850177/',
      commercialUseAllowed: true,
      sourcePageUrl: 'https://freesound.org/people/Mihacappy/sounds/850177/',
    },
    streamingAllowed: true,
    selfHostingAllowed: true,
    commercialUseAllowed: true,
  },
  {
    id: 'bell_chime',
    nameEn: 'Soft Bell',
    nameAr: 'جرس ناعم',
    descriptionEn: 'Soft candle-damper bell (CC BY — show attribution).',
    descriptionAr: 'جرس ناعم (CC BY — يلزم ذكر المصدر).',
    audioUrl: '',
    previewUrl: '',
    mediaFile: 'bell_chime.mp3',
    format: 'mp3',
    provider: 'freesound_selfhosted',
    source: 'Freesound',
    mood: 'soft_bell',
    durationSeconds: null,
    license: {
      spdxOrName: 'CC-BY-4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      attributionRequired: true,
      attributionText:
        'Bell / alert sound by InspectorJ (Freesound), CC BY — https://freesound.org/s/411089/',
      commercialUseAllowed: true,
      sourcePageUrl: 'https://freesound.org/people/InspectorJ/sounds/411089/',
    },
    streamingAllowed: true,
    selfHostingAllowed: true,
    commercialUseAllowed: true,
  },
  {
    id: 'hand_bell',
    nameEn: 'Soft Hand Bell',
    nameAr: 'جرس يدوي ناعم',
    descriptionEn: 'Single soft hand-bell tone (CC BY — show attribution).',
    descriptionAr: 'نغمة جرس يدوي ناعمة واحدة (CC BY — يلزم ذكر المصدر).',
    audioUrl: '',
    previewUrl: '',
    mediaFile: 'hand_bell.mp3',
    format: 'mp3',
    provider: 'freesound_selfhosted',
    source: 'Freesound',
    mood: 'soft_bell',
    durationSeconds: null,
    license: {
      spdxOrName: 'CC-BY-4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      attributionRequired: true,
      attributionText:
        'Hand Bells, B, Single by InspectorJ (Freesound), CC BY — https://freesound.org/s/339809/',
      commercialUseAllowed: true,
      sourcePageUrl: 'https://freesound.org/people/InspectorJ/sounds/339809/',
    },
    streamingAllowed: true,
    selfHostingAllowed: true,
    commercialUseAllowed: true,
  },
  {
    id: 'silent',
    nameEn: 'Silent',
    nameAr: 'صامت',
    descriptionEn: 'No sound (vibration only if enabled).',
    descriptionAr: 'بدون صوت (اهتزاز فقط إن كان مفعلاً).',
    audioUrl: null,
    previewUrl: null,
    mediaFile: null,
    format: 'none',
    provider: 'none',
    source: 'n/a',
    mood: 'silent',
    durationSeconds: 0,
    license: {
      spdxOrName: 'none',
      licenseUrl: null,
      attributionRequired: false,
      attributionText: 'No audio',
      commercialUseAllowed: true,
      sourcePageUrl: '',
    },
    streamingAllowed: true,
    selfHostingAllowed: true,
    commercialUseAllowed: true,
  },
  // ================================================================
  // Near-prayer Arabic clips — files live ONLY in assets/near-prayer/ (not azan/, not notification/).
  // ================================================================
  {
    id: 'sc_near_auto',
    nameEn: 'Auto — Prayer-Specific Arabic Voice (Recommended 2026)',
    nameAr: 'تلقائي — صوت عربي لكل صلاة (موصى به 2026)',
    descriptionEn:
      'Sentinel: backend picks "اقتربت صلاة …" for the upcoming prayer (Fajr, Dhuhr or Jumuah on Friday, Asr, Maghrib, Isha).',
    descriptionAr:
      'مفتاح تلقائي: الباك إند يختار تلقائيًا مقطع "اقتربت صلاة <الاسم>" المناسب لكل تنبيه مسبق.',
    audioUrl: null,
    previewUrl: null,
    mediaFile: null,
    format: 'none',
    provider: 'soundcloud_reference',
    source: 'Sentinel — resolves dynamically to sc_near_* clips.',
    mood: 'prayer_specific_voice',
    matchesPrayer: null,
    isAutoSentinel: true,
    durationSeconds: null,
    license: {
      spdxOrName: 'none',
      licenseUrl: null,
      attributionRequired: true,
      attributionText:
        'Near-prayer voice clips from SoundCloud playlist "تنبيهات إقتراب الصلاة" https://on.soundcloud.com/6uPo6iLHvhLfD211Hu.',
      commercialUseAllowed: true,
      sourcePageUrl: 'https://on.soundcloud.com/6uPo6iLHvhLfD211Hu',
    },
    streamingAllowed: false,
    selfHostingAllowed: false,
    commercialUseAllowed: true,
  },
  {
    id: 'sc_near_fajr',
    nameEn: '"اقتربت صلاة الفجر" — Fajr Approaching',
    nameAr: 'اقتربت صلاة الفجر — صوت',
    descriptionEn: 'Playlist Track 2: short Arabic announcement. Auto-matches FAJR (short pre-reminder window).',
    descriptionAr: 'المسار ٢ من القائمة.',
    audioUrl: '',
    previewUrl: '',
    mediaFile: 'sc_near_fajr.mp3',
    format: 'mp3',
    provider: 'soundcloud_reference',
    source: 'SoundCloud m_gowaida/fajr-time',
    mood: 'prayer_specific_voice',
    matchesPrayer: 'FAJR',
    durationSeconds: null,
    license: {
      spdxOrName: 'none',
      licenseUrl: null,
      attributionRequired: true,
      attributionText: 'Near-prayer clips from SoundCloud playlist "تنبيهات إقتراب الصلاة".',
      commercialUseAllowed: true,
      sourcePageUrl: 'https://soundcloud.com/m_gowaida/fajr-time',
    },
    streamingAllowed: true,
    selfHostingAllowed: true,
    commercialUseAllowed: true,
  },
  {
    id: 'sc_near_dhuhr',
    nameEn: '"اقتربت صلاة الظهر" — Dhuhr Approaching',
    nameAr: 'اقتربت صلاة الظهر — صوت',
    descriptionEn: 'Playlist Track 3. Auto-matches DHUHR on non-Friday days.',
    descriptionAr: 'المسار ٣ من القائمة.',
    audioUrl: '',
    previewUrl: '',
    mediaFile: 'sc_near_dhuhr.mp3',
    format: 'mp3',
    provider: 'soundcloud_reference',
    source: 'SoundCloud m_gowaida/salat-dhur',
    mood: 'prayer_specific_voice',
    matchesPrayer: 'DHUHR',
    durationSeconds: null,
    license: {
      spdxOrName: 'none',
      licenseUrl: null,
      attributionRequired: true,
      attributionText: 'Near-prayer clips from SoundCloud playlist "تنبيهات إقتراب الصلاة".',
      commercialUseAllowed: true,
      sourcePageUrl: 'https://soundcloud.com/m_gowaida/salat-dhur',
    },
    streamingAllowed: true,
    selfHostingAllowed: true,
    commercialUseAllowed: true,
  },
  {
    id: 'sc_near_asr',
    nameEn: '"اقتربت صلاة العصر" — Asr Approaching',
    nameAr: 'اقتربت صلاة العصر — صوت',
    descriptionEn: 'Playlist Track 4.',
    descriptionAr: 'المسار ٤ من القائمة.',
    audioUrl: '',
    previewUrl: '',
    mediaFile: 'sc_near_asr.mp3',
    format: 'mp3',
    provider: 'soundcloud_reference',
    source: 'SoundCloud m_gowaida/salat_asr',
    mood: 'prayer_specific_voice',
    matchesPrayer: 'ASR',
    durationSeconds: null,
    license: {
      spdxOrName: 'none',
      licenseUrl: null,
      attributionRequired: true,
      attributionText: 'Near-prayer clips from SoundCloud playlist "تنبيهات إقتراب الصلاة".',
      commercialUseAllowed: true,
      sourcePageUrl: 'https://soundcloud.com/m_gowaida/salat_asr',
    },
    streamingAllowed: true,
    selfHostingAllowed: true,
    commercialUseAllowed: true,
  },
  {
    id: 'sc_near_maghrib',
    nameEn: '"اقتربت صلاة المغرب" — Maghrib Approaching',
    nameAr: 'اقتربت صلاة المغرب — صوت',
    descriptionEn: 'Playlist Track 5.',
    descriptionAr: 'المسار ٥ من القائمة.',
    audioUrl: '',
    previewUrl: '',
    mediaFile: 'sc_near_maghrib.mp3',
    format: 'mp3',
    provider: 'soundcloud_reference',
    source: 'SoundCloud m_gowaida/salat_maghrib',
    mood: 'prayer_specific_voice',
    matchesPrayer: 'MAGHRIB',
    durationSeconds: null,
    license: {
      spdxOrName: 'none',
      licenseUrl: null,
      attributionRequired: true,
      attributionText: 'Near-prayer clips from SoundCloud playlist "تنبيهات إقتراب الصلاة".',
      commercialUseAllowed: true,
      sourcePageUrl: 'https://soundcloud.com/m_gowaida/salat_maghrib',
    },
    streamingAllowed: true,
    selfHostingAllowed: true,
    commercialUseAllowed: true,
  },
  {
    id: 'sc_near_isha',
    nameEn: '"اقتربت صلاة العشاء" — Isha Approaching',
    nameAr: 'اقتربت صلاة العشاء — صوت',
    descriptionEn: 'Playlist Track 6.',
    descriptionAr: 'المسار ٦ من القائمة.',
    audioUrl: '',
    previewUrl: '',
    mediaFile: 'sc_near_isha.mp3',
    format: 'mp3',
    provider: 'soundcloud_reference',
    source: 'SoundCloud m_gowaida/salat-ishaa',
    mood: 'prayer_specific_voice',
    matchesPrayer: 'ISHA',
    durationSeconds: null,
    license: {
      spdxOrName: 'none',
      licenseUrl: null,
      attributionRequired: true,
      attributionText: 'Near-prayer clips from SoundCloud playlist "تنبيهات إقتراب الصلاة".',
      commercialUseAllowed: true,
      sourcePageUrl: 'https://soundcloud.com/m_gowaida/salat-ishaa',
    },
    streamingAllowed: true,
    selfHostingAllowed: true,
    commercialUseAllowed: true,
  },
  {
    id: 'sc_near_jumuah',
    nameEn: '"اقتربت صلاة الجمعة" — Jumuah Approaching',
    nameAr: 'اقتربت صلاة الجمعة — صوت',
    descriptionEn: 'Playlist Track 7. Replaces sc_near_dhuhr on Fridays when auto-sentinel enabled.',
    descriptionAr: 'المسار ٧ من القائمة — يختاره تلقائيًا يوم الجمعة.',
    audioUrl: '',
    previewUrl: '',
    mediaFile: 'sc_near_jumuah.mp3',
    format: 'mp3',
    provider: 'soundcloud_reference',
    source: 'SoundCloud m_gowaida/salat_jumaa',
    mood: 'prayer_specific_voice',
    matchesPrayer: 'JUMUAH',
    durationSeconds: null,
    license: {
      spdxOrName: 'none',
      licenseUrl: null,
      attributionRequired: true,
      attributionText: 'Near-prayer clips from SoundCloud playlist "تنبيهات إقتراب الصلاة".',
      commercialUseAllowed: true,
      sourcePageUrl: 'https://soundcloud.com/m_gowaida/salat_jumaa',
    },
    streamingAllowed: true,
    selfHostingAllowed: true,
    commercialUseAllowed: true,
  },
];

export const DEFAULT_AZAN_SOUND_ID = 'mishary_alafasy';
export const DEFAULT_NOTIFICATION_SOUND_ID = 'soft_chime';
export const RECOMMENDED_NOTIFICATION_SOUND_ID_2026 = 'sc_near_auto';

/** Legacy / removed Commons ids + friendly aliases → famous catalog. */
const AZAN_ID_ALIASES: Record<string, string> = {
  mishary_alafasy: 'mishary_alafasy',
  mishary_alafasy_2: 'mishary_alafasy_2',
  mishary_alafasy_3: 'mishary_alafasy_3',
  ali_mulla: 'ali_mulla',
  yasser_al_dosari: 'yasser_al_dosari',
  nasser_al_qatami: 'nasser_al_qatami',
  abdul_basit: 'abdul_basit',
  mohamed_minshawi: 'mohamed_minshawi',
  mohamed_rifaat: 'mohamed_rifaat',
  mishary: 'mishary_alafasy',
  alafasy: 'mishary_alafasy',
  makkah: 'ali_mulla',
  azan1: 'mishary_alafasy',
  beautiful_adhan: 'mishary_alafasy',
  hassan_ii_casablanca: 'mishary_alafasy',
  aaqib_azeez: 'mishary_alafasy',
  islamic_call_mahfoudou: 'mishary_alafasy',
  azan_andrewler: 'mishary_alafasy',
  adhan_wiki: 'mishary_alafasy',
  adhan_aishatu: 'mishary_alafasy',
  madinah: 'mishary_alafasy_2',
  madina: 'mishary_alafasy_2',
  azan2: 'mishary_alafasy_2',
  aqsa: 'mishary_alafasy_3',
  al_aqsa: 'mishary_alafasy_3',
  azan3: 'mishary_alafasy_3',
  egypt: 'abdul_basit',
  egyptian: 'abdul_basit',
  cairo: 'mohamed_rifaat',
  azan4: 'abdul_basit',
  turkey: 'mishary_alafasy',
  turkish: 'mishary_alafasy',
  azan5: 'mishary_alafasy',
  soft: 'mishary_alafasy',
  gentle: 'mishary_alafasy',
  azan6: 'mishary_alafasy',
  abdulbasit: 'abdul_basit',
  azan7: 'abdul_basit',
  azan8: 'mishary_alafasy',
  cairo_fajr: 'abdul_basit',
  makkah_fajr: 'ali_mulla',
  yasser_dosari: 'yasser_al_dosari',
  dosari: 'yasser_al_dosari',
  qatami: 'nasser_al_qatami',
  minshawi: 'mohamed_minshawi',
  rifaat: 'mohamed_rifaat',
  refaat: 'mohamed_rifaat',
  toubar: 'mishary_alafasy',
};

const NOTIFICATION_ID_ALIASES: Record<string, string> = {
  soft_chime: 'soft_chime',
  beep_short: 'soft_chime',
  notify_beep: 'soft_chime',
  notify_punchy: 'xylophone_chime',
  gui_notify: 'xylophone_chime',
  digital_blip: 'soft_chime',
  digital_watch: 'soft_chime',
  game_notify: 'meditation_bell',
  alarm_clock: 'meditation_bell',
  sparkle_tone: 'singing_bowl',
  message_pop: 'singing_bowl',
  dingaling: 'hand_bell',
  phone_ring: 'hand_bell',
  medium_bell: 'bell_chime',
  dinner_bell: 'bell_chime',
  bugle: 'bell_chime',
  ui_alert: 'soft_chime',
  bell_chime: 'bell_chime',
  meditation_bell: 'meditation_bell',
  singing_bowl: 'singing_bowl',
  xylophone_chime: 'xylophone_chime',
  hand_bell: 'hand_bell',
  silent: 'silent',
  sc_near_auto: 'sc_near_auto',
  near_auto: 'sc_near_auto',
  auto_voice: 'sc_near_auto',
  prayer_voice: 'sc_near_auto',
  sc_2026_voice: 'sc_near_auto',
  recommended_2026: 'sc_near_auto',
  'soundcloud_near-1': 'sc_near_fajr',
  'soundcloud_near-2': 'sc_near_dhuhr',
  'soundcloud_near-3': 'sc_near_asr',
  'soundcloud_near-4': 'sc_near_maghrib',
  'soundcloud_near-5': 'sc_near_isha',
  'soundcloud_near-6': 'sc_near_jumuah',
  'soundcloud_near-7': 'sc_near_fajr',
  'soundcloud_near-8': 'sc_near_isha',
  near_fajr: 'sc_near_fajr',
  near_dhuhr: 'sc_near_dhuhr',
  near_asr: 'sc_near_asr',
  near_maghrib: 'sc_near_maghrib',
  near_isha: 'sc_near_isha',
  near_jumuah: 'sc_near_jumuah',
  fajr_alarm: 'sc_near_fajr',
  sc_fajr_alarm: 'sc_near_fajr',
  near_qiyam: 'sc_near_isha',
  sc_near_qiyam: 'sc_near_isha',
};

export function resolveAzanSoundId(raw?: string | null): string {
  if (!raw?.trim()) return DEFAULT_AZAN_SOUND_ID;
  const key = raw.trim().toLowerCase().replace(/-/g, '_');
  return (
    AZAN_ID_ALIASES[key] ??
    (AZAN_SOUND_OPTIONS.some((o) => o.id === key) ? key : DEFAULT_AZAN_SOUND_ID)
  );
}

export function getAzanSoundById(raw?: string | null): AzanSoundOption {
  const id = resolveAzanSoundId(raw);
  return (
    AZAN_SOUND_OPTIONS.find((o) => o.id === id) ??
    AZAN_SOUND_OPTIONS.find((o) => o.isDefault) ??
    AZAN_SOUND_OPTIONS[0]!
  );
}

export function resolveNotificationSoundId(raw?: string | null): string {
  if (!raw?.trim()) return DEFAULT_NOTIFICATION_SOUND_ID;
  const key = raw.trim().toLowerCase().replace(/-/g, '_');
  return (
    NOTIFICATION_ID_ALIASES[key] ??
    (NOTIFICATION_SOUND_OPTIONS.some((o) => o.id === key) ? key : DEFAULT_NOTIFICATION_SOUND_ID)
  );
}

export function getNotificationSoundById(raw?: string | null): NotificationSoundOption {
  const id = resolveNotificationSoundId(raw);
  return (
    NOTIFICATION_SOUND_OPTIONS.find((o) => o.id === id) ??
    NOTIFICATION_SOUND_OPTIONS.find((o) => o.isDefault) ??
    NOTIFICATION_SOUND_OPTIONS[0]!
  );
}

export const AUDIO_SOURCE_POLICY = {
  azanProvider: 'aladhan_and_assabile_selfhosted',
  notificationProvider: 'freesound_selfhosted',
  delivery:
    'Azan audio is mirrored under /api/v1/azan/media/:file from AlAdhan (Alafasy) and Assabile (other labeled famous Adhans). External CDNs alone can be flaky.',
  policy:
    'Ship only famous muezzin Adhans with a labeled source page + HTTP-verified audio. Mirror for reliable Flutter playback. Do not invent famous-voice labels. Unavailable priority voices stay in famousVoicesAudit.',
  sources: [
    'https://aladhan.com/download-adhans',
    'https://www.assabile.com/adhan-call-prayer',
  ],
} as const;

/** Self-hosted Azan mirrors + notification tones. */
export const AZAN_MEDIA_FILES: Record<string, { relativePath: string; contentType: string }> = {
  'mishary_alafasy.mp3': {
    relativePath: 'azan/mishary_alafasy.mp3',
    contentType: 'audio/mpeg',
  },
  'mishary_alafasy_2.mp3': {
    relativePath: 'azan/mishary_alafasy_2.mp3',
    contentType: 'audio/mpeg',
  },
  'mishary_alafasy_3.mp3': {
    relativePath: 'azan/mishary_alafasy_3.mp3',
    contentType: 'audio/mpeg',
  },
  'ali_mulla.mp3': { relativePath: 'azan/ali_mulla.mp3', contentType: 'audio/mpeg' },
  'yasser_al_dosari.mp3': {
    relativePath: 'azan/yasser_al_dosari.mp3',
    contentType: 'audio/mpeg',
  },
  'nasser_al_qatami.mp3': {
    relativePath: 'azan/nasser_al_qatami.mp3',
    contentType: 'audio/mpeg',
  },
  'abdul_basit.mp3': { relativePath: 'azan/abdul_basit.mp3', contentType: 'audio/mpeg' },
  'mohamed_minshawi.mp3': {
    relativePath: 'azan/mohamed_minshawi.mp3',
    contentType: 'audio/mpeg',
  },
  'mohamed_rifaat.mp3': { relativePath: 'azan/mohamed_rifaat.mp3', contentType: 'audio/mpeg' },
  'soft_chime.mp3': { relativePath: 'notification/soft_chime.mp3', contentType: 'audio/mpeg' },
  'meditation_bell.mp3': {
    relativePath: 'notification/meditation_bell.mp3',
    contentType: 'audio/mpeg',
  },
  'singing_bowl.mp3': {
    relativePath: 'notification/singing_bowl.mp3',
    contentType: 'audio/mpeg',
  },
  'xylophone_chime.mp3': {
    relativePath: 'notification/xylophone_chime.mp3',
    contentType: 'audio/mpeg',
  },
  'bell_chime.mp3': { relativePath: 'notification/bell_chime.mp3', contentType: 'audio/mpeg' },
  'hand_bell.mp3': { relativePath: 'notification/hand_bell.mp3', contentType: 'audio/mpeg' },
  // Near-prayer Arabic clips — ONLY under assets/near-prayer/ (never azan/ or notification/).
  // On disk: fajr, dhuhr, asr, maghrib, isha, jumuah.
  'sc_near_fajr.mp3': { relativePath: 'near-prayer/sc_near_fajr.mp3', contentType: 'audio/mpeg' },
  'sc_near_dhuhr.mp3': { relativePath: 'near-prayer/sc_near_dhuhr.mp3', contentType: 'audio/mpeg' },
  'sc_near_asr.mp3': { relativePath: 'near-prayer/sc_near_asr.mp3', contentType: 'audio/mpeg' },
  'sc_near_maghrib.mp3': { relativePath: 'near-prayer/sc_near_maghrib.mp3', contentType: 'audio/mpeg' },
  'sc_near_isha.mp3': { relativePath: 'near-prayer/sc_near_isha.mp3', contentType: 'audio/mpeg' },
  'sc_near_jumuah.mp3': { relativePath: 'near-prayer/sc_near_jumuah.mp3', contentType: 'audio/mpeg' },
};
