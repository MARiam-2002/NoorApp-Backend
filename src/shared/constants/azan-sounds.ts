/**
 * Azan + notification catalogs for Noor App.
 *
 * Azan: modern famous voices streamed from AlAdhan / Islamic Network CDN
 * (external URLs — not self-hosted). Only voices with a working, labeled
 * Adhan file on https://aladhan.com/download-adhans are listed.
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
  category: 'famous_contemporary';
  /** Absolute external stream URL (preferred for Azan). */
  audioUrl: string;
  previewUrl: string;
  /** Null when audio is external-only (not on /azan/media). */
  mediaFile: string | null;
  format: 'mp3';
  provider: 'aladhan_cdn';
  source: string;
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
  provider: 'freesound_selfhosted' | 'none';
  source: string;
  license: AudioLicense;
  streamingAllowed: boolean;
  selfHostingAllowed: boolean;
  commercialUseAllowed: boolean;
  durationSeconds: number | null;
  mood: 'calm' | 'gentle' | 'soft_bell' | 'silent';
  isDefault?: boolean;
};

const aladhanLicense = (recordingTitle: string): AudioLicense => ({
  spdxOrName: 'none',
  licenseUrl: null,
  attributionRequired: true,
  attributionText: `${recordingTitle} — streamed from AlAdhan / Islamic Network CDN (https://aladhan.com/download-adhans). Mu’adhin performance rights remain with the reciter.`,
  commercialUseAllowed: true,
  sourcePageUrl: 'https://aladhan.com/download-adhans',
});

/**
 * Priority famous voices requested for Noor.
 * Only entries with a verified working Adhan stream URL are in AZAN_SOUND_OPTIONS.
 */
export const FAMOUS_AZAN_VOICE_AUDIT = [
  {
    nameEn: 'Ali Ahmed Mulla',
    nameAr: 'علي أحمد ملا',
    status: 'unavailable',
    reason:
      'No reliable labeled Adhan stream URL found on AlAdhan CDN or other app-oriented sources. Commercial releases exist; do not invent YouTube/MP3-site links.',
  },
  {
    nameEn: 'Yasser Al-Dosari',
    nameAr: 'ياسر الدوسري',
    status: 'unavailable',
    reason: 'No reliable labeled Adhan stream URL found for app playback.',
  },
  {
    nameEn: 'Mishary Rashid Alafasy',
    nameAr: 'مشاري راشد العفاسي',
    status: 'available',
    reason: 'Three Adhan recordings on AlAdhan CDN (a4, a7, a9) — HTTP 200, Range supported.',
  },
  {
    nameEn: 'Bandar Baleela',
    nameAr: 'بندر بليلة',
    status: 'unavailable',
    reason: 'No reliable labeled Adhan stream URL found for app playback.',
  },
  {
    nameEn: 'Maher Al-Muaiqly',
    nameAr: 'ماهر المعيقلي',
    status: 'unavailable',
    reason: 'No reliable labeled Adhan stream URL found for app playback.',
  },
  {
    nameEn: 'Nasser Al-Qatami',
    nameAr: 'ناصر القطامي',
    status: 'unavailable',
    reason: 'No reliable labeled Adhan stream URL found for app playback.',
  },
  {
    nameEn: 'Abdul Rahman Al-Sudais',
    nameAr: 'عبد الرحمن السديس',
    status: 'unavailable',
    reason: 'No reliable labeled Adhan stream URL found for app playback.',
  },
  {
    nameEn: 'Ahmed Al-Ajmi',
    nameAr: 'أحمد العجمي',
    status: 'unavailable',
    reason: 'No reliable labeled Adhan stream URL found for app playback.',
  },
  {
    nameEn: 'Saad Al-Ghamdi',
    nameAr: 'سعد الغامدي',
    status: 'unavailable',
    reason: 'No reliable labeled Adhan stream URL found for app playback.',
  },
  {
    nameEn: 'Nasr El-Din ToubAr',
    nameAr: 'نصر الدين طوبار',
    status: 'unavailable',
    reason: 'No reliable labeled Adhan stream URL found for app playback.',
  },
] as const;

const ALAFASY = {
  muezzin: 'Mishary Rashid Alafasy',
  muezzinEn: 'Mishary Rashid Alafasy',
  muezzinAr: 'مشاري راشد العفاسي',
} as const;

/**
 * Live Azan catalog — famous contemporary only (external stream).
 * Old Commons community recordings removed from production.
 */
export const AZAN_SOUND_OPTIONS: AzanSoundOption[] = [
  {
    id: 'mishary_alafasy',
    nameEn: 'Mishary Alafasy',
    nameAr: 'مشاري العفاسي',
    descriptionEn:
      'Popular contemporary Islamic voice — Dubai One TV Adhan (clean MP3, AlAdhan CDN).',
    descriptionAr: 'صوت إسلامي معاصر محبوب — أذان قناة دبي ون (ملف نظيف عبر شبكة AlAdhan).',
    ...ALAFASY,
    locationEn: 'Contemporary Gulf voice',
    locationAr: 'صوت خليجي معاصر',
    isFamousVoice: true,
    category: 'famous_contemporary',
    audioUrl: 'https://cdn.aladhan.com/audio/adhans/a4.mp3',
    previewUrl: 'https://cdn.aladhan.com/audio/adhans/a4.mp3',
    mediaFile: null,
    format: 'mp3',
    provider: 'aladhan_cdn',
    source: 'AlAdhan CDN — Adhan from Dubai\'s One TV by Mishary Rashid Alafasy',
    isDefault: true,
    durationSeconds: null,
    license: aladhanLicense('Adhan from Dubai\'s One TV by Mishary Rashid Alafasy'),
    streamingAllowed: true,
    selfHostingAllowed: false,
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
    category: 'famous_contemporary',
    audioUrl: 'https://cdn.aladhan.com/audio/adhans/a7.mp3',
    previewUrl: 'https://cdn.aladhan.com/audio/adhans/a7.mp3',
    mediaFile: null,
    format: 'mp3',
    provider: 'aladhan_cdn',
    source: 'AlAdhan CDN — Another Adhan by Mishary Rashid Alafasy',
    durationSeconds: null,
    license: aladhanLicense('Another Adhan by Mishary Rashid Alafasy'),
    streamingAllowed: true,
    selfHostingAllowed: false,
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
    category: 'famous_contemporary',
    audioUrl: 'https://cdn.aladhan.com/audio/adhans/a9.mp3',
    previewUrl: 'https://cdn.aladhan.com/audio/adhans/a9.mp3',
    mediaFile: null,
    format: 'mp3',
    provider: 'aladhan_cdn',
    source: 'AlAdhan CDN — Yet Another Adhan by Mishary Rashid Alafasy',
    durationSeconds: null,
    license: aladhanLicense('Yet Another Adhan by Mishary Rashid Alafasy'),
    streamingAllowed: true,
    selfHostingAllowed: false,
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
];

export const DEFAULT_AZAN_SOUND_ID = 'mishary_alafasy';
export const DEFAULT_NOTIFICATION_SOUND_ID = 'soft_chime';

/** Legacy / removed Commons ids + friendly aliases → new famous catalog. */
const AZAN_ID_ALIASES: Record<string, string> = {
  mishary_alafasy: 'mishary_alafasy',
  mishary_alafasy_2: 'mishary_alafasy_2',
  mishary_alafasy_3: 'mishary_alafasy_3',
  mishary: 'mishary_alafasy',
  alafasy: 'mishary_alafasy',
  makkah: 'mishary_alafasy',
  azan1: 'mishary_alafasy',
  // Removed Commons catalog → map to default famous voice
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
  egypt: 'mishary_alafasy',
  egyptian: 'mishary_alafasy',
  cairo: 'mishary_alafasy',
  azan4: 'mishary_alafasy',
  turkey: 'mishary_alafasy',
  turkish: 'mishary_alafasy',
  azan5: 'mishary_alafasy',
  soft: 'mishary_alafasy',
  gentle: 'mishary_alafasy',
  azan6: 'mishary_alafasy',
  abdul_basit: 'mishary_alafasy',
  abdulbasit: 'mishary_alafasy',
  azan7: 'mishary_alafasy',
  azan8: 'mishary_alafasy',
  cairo_fajr: 'mishary_alafasy',
  makkah_fajr: 'mishary_alafasy',
  yasser_dosari: 'mishary_alafasy',
  dosari: 'mishary_alafasy',
  ali_mulla: 'mishary_alafasy',
  toubar: 'mishary_alafasy',
  refaat: 'mishary_alafasy',
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
  azanProvider: 'aladhan_cdn',
  notificationProvider: 'freesound_selfhosted',
  delivery:
    'Azan audio streams from AlAdhan CDN (external audioUrl). Notification tones remain self-hosted under /api/v1/azan/media/:file.',
  policy:
    'Ship only famous contemporary Adhan voices with a working labeled stream URL. Do not self-host Azan when the source is external CDN. Do not invent famous-voice labels for unknown MP3s. Other priority muezzins remain in famousVoicesAudit until a reliable stream exists.',
  sourcePage: 'https://aladhan.com/download-adhans',
} as const;

/** Self-hosted media (notifications only — Azan files removed). */
export const AZAN_MEDIA_FILES: Record<string, { relativePath: string; contentType: string }> = {
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
};
