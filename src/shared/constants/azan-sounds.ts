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
  mood: 'calm' | 'gentle' | 'soft_bell' | 'silent' | 'prayer_specific_voice' | 'prayer_event_voice';
  matchesPrayer?: string | null;
  /** Additive: FRIDAY | DUHA | QIYAM | FAJR… for prayer-event clips. */
  matchesEvent?: string | null;
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
    isDefault: true,
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

const freesoundCc0 = (attributionText: string, sourcePageUrl: string): AudioLicense => ({
  spdxOrName: 'CC0-1.0',
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  attributionRequired: false,
  attributionText,
  commercialUseAllowed: true,
  sourcePageUrl,
});

const freesoundCcBy = (attributionText: string, sourcePageUrl: string): AudioLicense => ({
  spdxOrName: 'CC-BY-4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  attributionRequired: true,
  attributionText,
  commercialUseAllowed: true,
  sourcePageUrl,
});

const tone = (
  partial: Omit<
    NotificationSoundOption,
    | 'audioUrl'
    | 'previewUrl'
    | 'format'
    | 'provider'
    | 'source'
    | 'streamingAllowed'
    | 'selfHostingAllowed'
    | 'commercialUseAllowed'
    | 'durationSeconds'
    | 'license'
  > & { license: AudioLicense; mediaFile: string },
): NotificationSoundOption => ({
  audioUrl: '',
  previewUrl: '',
  format: 'mp3',
  provider: 'freesound_selfhosted',
  source: 'assets/notification',
  streamingAllowed: true,
  selfHostingAllowed: true,
  commercialUseAllowed: true,
  durationSeconds: null,
  ...partial,
});

/**
 * GET /azan/notification-sounds — ONLY files under assets/notification/ (+ silent).
 * Near-prayer / prayer-event voices are separate catalogs (not mixed here).
 */
export const NOTIFICATION_SOUND_OPTIONS: NotificationSoundOption[] = [
  tone({
    id: 'soft_chime',
    nameEn: 'Soft Chime',
    nameAr: 'نغمة ناعمة',
    descriptionEn: 'Short soft reminder — recommended default.',
    descriptionAr: 'تنبيه ناعم قصير — الخيار الافتراضي.',
    mediaFile: 'soft_chime.mp3',
    isDefault: true,
    mood: 'calm',
    license: freesoundCc0(
      'Notification Sound 1 by deadrobotmusic (Freesound), CC0 1.0',
      'https://freesound.org/people/deadrobotmusic/sounds/750607/',
    ),
  }),
  tone({
    id: 'notify_beep',
    nameEn: 'Notify Beep',
    nameAr: 'صفير تنبيه',
    descriptionEn: 'Short notification beep.',
    descriptionAr: 'صفير تنبيه قصير.',
    mediaFile: 'notify_beep.mp3',
    mood: 'calm',
    license: freesoundCc0('notify_beep — assets/notification', ''),
  }),
  tone({
    id: 'digital_blip',
    nameEn: 'Digital Blip',
    nameAr: 'نبضة رقمية',
    descriptionEn: 'Short digital blip.',
    descriptionAr: 'نبضة رقمية قصيرة.',
    mediaFile: 'digital_blip.mp3',
    mood: 'calm',
    license: freesoundCc0('digital_blip — assets/notification', ''),
  }),
  tone({
    id: 'ui_alert',
    nameEn: 'UI Alert',
    nameAr: 'تنبيه واجهة',
    descriptionEn: 'Light UI alert tone.',
    descriptionAr: 'نغمة تنبيه خفيفة للواجهة.',
    mediaFile: 'ui_alert.mp3',
    mood: 'calm',
    license: freesoundCc0('ui_alert — assets/notification', ''),
  }),
  tone({
    id: 'sparkle_tone',
    nameEn: 'Sparkle Tone',
    nameAr: 'نغمة لامعة',
    descriptionEn: 'Bright short sparkle tone.',
    descriptionAr: 'نغمة لامعة قصيرة.',
    mediaFile: 'sparkle_tone.mp3',
    mood: 'gentle',
    license: freesoundCc0('sparkle_tone — assets/notification', ''),
  }),
  tone({
    id: 'message_pop',
    nameEn: 'Message Pop',
    nameAr: 'نبضة رسالة',
    descriptionEn: 'Soft message-pop tone.',
    descriptionAr: 'نغمة رسالة ناعمة.',
    mediaFile: 'message_pop.mp3',
    mood: 'gentle',
    license: freesoundCc0('message_pop — assets/notification', ''),
  }),
  tone({
    id: 'gui_notify',
    nameEn: 'GUI Notify',
    nameAr: 'تنبيه واجهة رسومية',
    descriptionEn: 'Classic GUI notification.',
    descriptionAr: 'تنبيه واجهة رسومية كلاسيكي.',
    mediaFile: 'gui_notify.mp3',
    mood: 'gentle',
    license: freesoundCc0('gui_notify — assets/notification', ''),
  }),
  tone({
    id: 'game_notify',
    nameEn: 'Game Notify',
    nameAr: 'تنبيه لعبة',
    descriptionEn: 'Soft game-style notify.',
    descriptionAr: 'تنبيه بأسلوب ألعاب ناعم.',
    mediaFile: 'game_notify.mp3',
    mood: 'gentle',
    license: freesoundCc0('game_notify — assets/notification', ''),
  }),
  tone({
    id: 'notify_punchy',
    nameEn: 'Punchy Notify',
    nameAr: 'تنبيه واضح',
    descriptionEn: 'Punchier short notify.',
    descriptionAr: 'تنبيه قصير أوضح.',
    mediaFile: 'notify_punchy.mp3',
    mood: 'gentle',
    license: freesoundCc0('notify_punchy — assets/notification', ''),
  }),
  tone({
    id: 'dingaling',
    nameEn: 'Dingaling',
    nameAr: 'رنين خفيف',
    descriptionEn: 'Light ding tone.',
    descriptionAr: 'رنين خفيف.',
    mediaFile: 'dingaling.mp3',
    mood: 'soft_bell',
    license: freesoundCc0('dingaling — assets/notification', ''),
  }),
  tone({
    id: 'meditation_bell',
    nameEn: 'Meditation Bell',
    nameAr: 'جرس تأملي',
    descriptionEn: 'Soft meditation bell.',
    descriptionAr: 'جرس تأملي ناعم.',
    mediaFile: 'meditation_bell.mp3',
    mood: 'gentle',
    license: freesoundCc0(
      'bell-meditation_cleaned.wav by JetRye (Freesound), CC0 1.0',
      'https://freesound.org/people/JetRye/sounds/140128/',
    ),
  }),
  tone({
    id: 'singing_bowl',
    nameEn: 'Singing Bowl',
    nameAr: 'وعاء غنائي',
    descriptionEn: 'Soft singing-bowl hit.',
    descriptionAr: 'ضربة ناعمة لوعاء غنائي.',
    mediaFile: 'singing_bowl.mp3',
    mood: 'gentle',
    license: freesoundCc0(
      'Singing Bowl — Soft Stick Meditative Hit by Rimych (Freesound), CC0 1.0',
      'https://freesound.org/people/Rimych/sounds/616335/',
    ),
  }),
  tone({
    id: 'xylophone_chime',
    nameEn: 'Xylophone Chime',
    nameAr: 'نغمة إكسيليفون',
    descriptionEn: 'Soft xylophone-style chime.',
    descriptionAr: 'نغمة إكسيليفون ناعمة.',
    mediaFile: 'xylophone_chime.mp3',
    mood: 'gentle',
    license: freesoundCc0(
      'notify3.wav by Mihacappy (Freesound), CC0 1.0',
      'https://freesound.org/people/Mihacappy/sounds/850177/',
    ),
  }),
  tone({
    id: 'bell_chime',
    nameEn: 'Bell Chime',
    nameAr: 'جرس ناعم',
    descriptionEn: 'Soft bell chime (CC BY — show attribution).',
    descriptionAr: 'جرس ناعم (CC BY — يلزم ذكر المصدر).',
    mediaFile: 'bell_chime.mp3',
    mood: 'soft_bell',
    license: freesoundCcBy(
      'Bell / alert sound by InspectorJ (Freesound), CC BY',
      'https://freesound.org/people/InspectorJ/sounds/411089/',
    ),
  }),
  tone({
    id: 'hand_bell',
    nameEn: 'Hand Bell',
    nameAr: 'جرس يدوي',
    descriptionEn: 'Single soft hand-bell (CC BY — show attribution).',
    descriptionAr: 'جرس يدوي ناعم (CC BY — يلزم ذكر المصدر).',
    mediaFile: 'hand_bell.mp3',
    mood: 'soft_bell',
    license: freesoundCcBy(
      'Hand Bells, B, Single by InspectorJ (Freesound), CC BY',
      'https://freesound.org/people/InspectorJ/sounds/339809/',
    ),
  }),
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
];

const nearLicense: AudioLicense = {
  spdxOrName: 'none',
  licenseUrl: null,
  attributionRequired: true,
  attributionText: 'Near-prayer clips from SoundCloud playlist "تنبيهات إقتراب الصلاة".',
  commercialUseAllowed: true,
  sourcePageUrl: 'https://on.soundcloud.com/6uPo6iLHvhLfD211Hu',
};

const eventLicense: AudioLicense = {
  spdxOrName: 'none',
  licenseUrl: null,
  attributionRequired: true,
  attributionText: 'Noor prayer-event Arabic clips.',
  commercialUseAllowed: true,
  sourcePageUrl: '',
};

/** assets/near-prayer/ — NOT listed in GET /azan/notification-sounds. */
export const NEAR_PRAYER_SOUND_OPTIONS: NotificationSoundOption[] = [
  {
    id: 'sc_near_auto',
    nameEn: 'Auto — Prayer-Specific Arabic Voice',
    nameAr: 'تلقائي — صوت عربي لكل صلاة',
    descriptionEn: 'Sentinel: backend picks sc_near_* for the upcoming prayer.',
    descriptionAr: 'مفتاح تلقائي يختار مقطع اقترب الصلاة المناسب.',
    audioUrl: null,
    previewUrl: null,
    mediaFile: null,
    format: 'none',
    provider: 'soundcloud_reference',
    source: 'assets/near-prayer',
    mood: 'prayer_specific_voice',
    matchesPrayer: null,
    isAutoSentinel: true,
    durationSeconds: null,
    license: nearLicense,
    streamingAllowed: false,
    selfHostingAllowed: false,
    commercialUseAllowed: true,
  },
  ...(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha', 'jumuah'] as const).map((p) => ({
    id: `sc_near_${p}`,
    nameEn: `Near ${p}`,
    nameAr: `اقتراب ${p}`,
    descriptionEn: `Short Arabic approaching clip for ${p}.`,
    descriptionAr: `مقطع اقتراب صلاة عربي — ${p}.`,
    audioUrl: '',
    previewUrl: '',
    mediaFile: `sc_near_${p}.mp3`,
    format: 'mp3' as const,
    provider: 'soundcloud_reference' as const,
    source: 'assets/near-prayer',
    mood: 'prayer_specific_voice' as const,
    matchesPrayer: p.toUpperCase() === 'JUMUAH' ? 'JUMUAH' : p.toUpperCase(),
    durationSeconds: null,
    license: nearLicense,
    streamingAllowed: true,
    selfHostingAllowed: true,
    commercialUseAllowed: true,
  })),
];

/** assets/prayer-events/ — NOT listed in GET /azan/notification-sounds. */
export const PRAYER_EVENT_SOUND_OPTIONS: NotificationSoundOption[] = (
  [
    ['fajr', 'FAJR', 'FAJR'],
    ['dhuhr', 'DHUHR', 'DHUHR'],
    ['asr', 'ASR', 'ASR'],
    ['maghrib', 'MAGHRIB', 'MAGHRIB'],
    ['isha', 'ISHA', 'ISHA'],
    ['jumuah', 'JUMUAH', 'FRIDAY'],
    ['duha', null, 'DUHA'],
    ['qiyam', null, 'QIYAM'],
  ] as const
).map(([p, prayer, event]) => ({
  id: `sc_event_${p}`,
  nameEn: `${p} event voice`,
  nameAr: `صوت حدث ${p}`,
  descriptionEn: `Short Arabic clip for ${p} local prayer events.`,
  descriptionAr: `مقطع عربي قصير لحدث ${p}.`,
  audioUrl: '',
  previewUrl: '',
  mediaFile: `sc_event_${p}.mp3`,
  format: 'mp3' as const,
  provider: 'soundcloud_reference' as const,
  source: 'assets/prayer-events',
  mood: 'prayer_event_voice' as const,
  matchesPrayer: prayer,
  matchesEvent: event,
  durationSeconds: null,
  license: eventLicense,
  streamingAllowed: true,
  selfHostingAllowed: true,
  commercialUseAllowed: true,
}));

/**
 * Full resolver catalog: notification folder + near-prayer + prayer-events.
 * Used so saved prefs / FCM can still resolve sc_near_* and sc_event_*.
 */
export const REMINDER_SOUND_OPTIONS: NotificationSoundOption[] = [
  ...NOTIFICATION_SOUND_OPTIONS,
  ...NEAR_PRAYER_SOUND_OPTIONS,
  ...PRAYER_EVENT_SOUND_OPTIONS,
];

export const DEFAULT_AZAN_SOUND_ID = 'nasser_al_qatami';
export const DEFAULT_NOTIFICATION_SOUND_ID = 'soft_chime';
/** Near-prayer auto sentinel (not part of assets/notification list). */
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

/** Prefer identity for assets/notification files; keep near/event aliases for prefs. */
const NOTIFICATION_ID_ALIASES: Record<string, string> = {
  soft_chime: 'soft_chime',
  beep_short: 'soft_chime',
  notify_beep: 'notify_beep',
  notify_punchy: 'notify_punchy',
  gui_notify: 'gui_notify',
  digital_blip: 'digital_blip',
  digital_watch: 'digital_blip',
  game_notify: 'game_notify',
  alarm_clock: 'meditation_bell',
  sparkle_tone: 'sparkle_tone',
  message_pop: 'message_pop',
  dingaling: 'dingaling',
  phone_ring: 'dingaling',
  medium_bell: 'bell_chime',
  dinner_bell: 'bell_chime',
  bugle: 'bell_chime',
  ui_alert: 'ui_alert',
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
  sc_near_fajr: 'sc_near_fajr',
  sc_near_dhuhr: 'sc_near_dhuhr',
  sc_near_asr: 'sc_near_asr',
  sc_near_maghrib: 'sc_near_maghrib',
  sc_near_isha: 'sc_near_isha',
  sc_near_jumuah: 'sc_near_jumuah',
  sc_event_fajr: 'sc_event_fajr',
  sc_event_dhuhr: 'sc_event_dhuhr',
  sc_event_asr: 'sc_event_asr',
  sc_event_maghrib: 'sc_event_maghrib',
  sc_event_isha: 'sc_event_isha',
  sc_event_jumuah: 'sc_event_jumuah',
  sc_event_duha: 'sc_event_duha',
  sc_event_qiyam: 'sc_event_qiyam',
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
    (REMINDER_SOUND_OPTIONS.some((o) => o.id === key) ? key : DEFAULT_NOTIFICATION_SOUND_ID)
  );
}

export function getNotificationSoundById(raw?: string | null): NotificationSoundOption {
  const id = resolveNotificationSoundId(raw);
  return (
    REMINDER_SOUND_OPTIONS.find((o) => o.id === id) ??
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
    'Ship only famous muezzin Adhans with a labeled source page + HTTP-verified audio. Mirror for reliable Flutter playback. Do not invent famous-voice labels. Unavailable priority voices stay in famousVoicesAudit. GET /azan/notification-sounds lists ONLY assets/notification/*.mp3 (+ silent). Near-prayer and prayer-event clips remain under separate folders and resolver catalogs.',
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
  // assets/notification only
  'soft_chime.mp3': { relativePath: 'notification/soft_chime.mp3', contentType: 'audio/mpeg' },
  'notify_beep.mp3': { relativePath: 'notification/notify_beep.mp3', contentType: 'audio/mpeg' },
  'digital_blip.mp3': { relativePath: 'notification/digital_blip.mp3', contentType: 'audio/mpeg' },
  'ui_alert.mp3': { relativePath: 'notification/ui_alert.mp3', contentType: 'audio/mpeg' },
  'sparkle_tone.mp3': { relativePath: 'notification/sparkle_tone.mp3', contentType: 'audio/mpeg' },
  'message_pop.mp3': { relativePath: 'notification/message_pop.mp3', contentType: 'audio/mpeg' },
  'gui_notify.mp3': { relativePath: 'notification/gui_notify.mp3', contentType: 'audio/mpeg' },
  'game_notify.mp3': { relativePath: 'notification/game_notify.mp3', contentType: 'audio/mpeg' },
  'notify_punchy.mp3': { relativePath: 'notification/notify_punchy.mp3', contentType: 'audio/mpeg' },
  'dingaling.mp3': { relativePath: 'notification/dingaling.mp3', contentType: 'audio/mpeg' },
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
  // Near-prayer Arabic clips — ONLY under assets/near-prayer/
  'sc_near_fajr.mp3': { relativePath: 'near-prayer/sc_near_fajr.mp3', contentType: 'audio/mpeg' },
  'sc_near_dhuhr.mp3': { relativePath: 'near-prayer/sc_near_dhuhr.mp3', contentType: 'audio/mpeg' },
  'sc_near_asr.mp3': { relativePath: 'near-prayer/sc_near_asr.mp3', contentType: 'audio/mpeg' },
  'sc_near_maghrib.mp3': { relativePath: 'near-prayer/sc_near_maghrib.mp3', contentType: 'audio/mpeg' },
  'sc_near_isha.mp3': { relativePath: 'near-prayer/sc_near_isha.mp3', contentType: 'audio/mpeg' },
  'sc_near_jumuah.mp3': { relativePath: 'near-prayer/sc_near_jumuah.mp3', contentType: 'audio/mpeg' },
  // Prayer-event short clips — ONLY under assets/prayer-events/
  'sc_event_fajr.mp3': { relativePath: 'prayer-events/sc_event_fajr.mp3', contentType: 'audio/mpeg' },
  'sc_event_dhuhr.mp3': { relativePath: 'prayer-events/sc_event_dhuhr.mp3', contentType: 'audio/mpeg' },
  'sc_event_asr.mp3': { relativePath: 'prayer-events/sc_event_asr.mp3', contentType: 'audio/mpeg' },
  'sc_event_maghrib.mp3': { relativePath: 'prayer-events/sc_event_maghrib.mp3', contentType: 'audio/mpeg' },
  'sc_event_isha.mp3': { relativePath: 'prayer-events/sc_event_isha.mp3', contentType: 'audio/mpeg' },
  'sc_event_jumuah.mp3': { relativePath: 'prayer-events/sc_event_jumuah.mp3', contentType: 'audio/mpeg' },
  'sc_event_duha.mp3': { relativePath: 'prayer-events/sc_event_duha.mp3', contentType: 'audio/mpeg' },
  'sc_event_qiyam.mp3': { relativePath: 'prayer-events/sc_event_qiyam.mp3', contentType: 'audio/mpeg' },
};
