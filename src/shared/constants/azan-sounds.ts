/**
 * Production-safe Azan + notification catalogs for Noor App (license-verified).
 *
 * Product goal: authentic Islamic UX. Legal goal: never ship famous muezzin audio
 * without a clear redistribution / commercial-app grant.
 *
 * REJECTED famous voices (copyrighted / unclear rights — do NOT add without written permission):
 * - Nasr El-Din ToubAr, Mohamed Refaat, Abdul Basit, Minshawi, Taha El-Fashny, Mohamed Emran
 * - Ali Ahmed Mulla (Masjid Al-Haram), Mishary Alafasy, Nasser Al-Qatami, Yasser Al-Dosari, Bandar Baleela
 * - Assabile.com / Al Furqan Athan API (Assabile-sourced), IslamCan, Kiwifu, Google Actions
 * - Internet Archive “Public Domain” uploads of Haram Azan (uploader tags are not copyright clearance;
 *   commercial catalogs on Apple Music/Spotify and Islamic Network notes that mu’adhin rights remain)
 *
 * ACCEPTED Azan: Wikimedia Commons recordings with verified CC0 / CC BY-SA on file pages (self-hosted).
 * ACCEPTED notifications: calm Freesound CC0 / CC BY tones suitable for a Qur’an app (self-hosted).
 *
 * Quran recitation audio remains separate: /quran/audio (Quran Foundation).
 */

export type AudioLicense = {
  spdxOrName:
    | 'CC0-1.0'
    | 'CC-BY-SA-4.0'
    | 'CC-BY-SA-3.0'
    | 'CC-BY-4.0'
    | 'CC-BY-3.0'
    | 'none';
  licenseUrl: string | null;
  attributionRequired: boolean;
  attributionText: string;
  commercialUseAllowed: boolean;
  sourcePageUrl: string;
};

export type RightsFlags = {
  streamingAllowed: boolean;
  selfHostingAllowed: boolean;
  commercialUseAllowed: boolean;
  /** How the rights decision was made. */
  rightsStatus: 'verified_open_license' | 'none';
};

export type AzanSoundOption = {
  id: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  muezzinEn: string;
  muezzinAr: string;
  locationEn?: string;
  locationAr?: string;
  /** Famous celebrity muezzin? Only true when identity + license both verified. */
  isFamousVoice: boolean;
  category: 'community_recording' | 'mosque_field_recording';
  audioUrl: string;
  /** Same as audioUrl — Flutter preview target. */
  previewUrl: string;
  mediaFile: string;
  format: 'mp3' | 'ogg' | 'oga';
  provider: 'wikimedia_commons_selfhosted';
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

const openRights = (commercial: boolean): RightsFlags => ({
  streamingAllowed: true,
  selfHostingAllowed: true,
  commercialUseAllowed: commercial,
  rightsStatus: 'verified_open_license',
});

/** Famous voices requested for Noor — not production-safe without written clearance. */
export const FAMOUS_AZAN_VOICE_AUDIT = [
  {
    nameEn: 'Sheikh Nasr El-Din ToubAr',
    nameAr: 'نصر الدين طوبار',
    status: 'blocked',
    reason:
      'Classic Egyptian Azan; commercially circulated recordings; no verified open license for redistribution or commercial app use.',
  },
  {
    nameEn: 'Sheikh Mohamed Refaat',
    nameAr: 'محمد رفعت',
    status: 'blocked',
    reason: 'Historic famous Egyptian Azan; recordings remain under third-party / estate rights; no clear CC grant found.',
  },
  {
    nameEn: 'Sheikh Abdul Basit Abdul Samad',
    nameAr: 'عبد الباسط عبد الصمد',
    status: 'blocked',
    reason: 'World-famous voice; professional recordings are copyrighted; no redistributable app license verified.',
  },
  {
    nameEn: 'Sheikh Mohamed Siddiq El-Minshawi',
    nameAr: 'محمد صديق المنشاوي',
    status: 'blocked',
    reason: 'Famous Egyptian reciter/Azan recordings are copyrighted; not available under a clear app-use license.',
  },
  {
    nameEn: 'Sheikh Taha El-Fashny',
    nameAr: 'طه الفشني',
    status: 'blocked',
    reason: 'Beloved classic Egyptian voice; no verified redistribution license for commercial mobile apps.',
  },
  {
    nameEn: 'Sheikh Mohamed Emran',
    nameAr: 'محمد عمران',
    status: 'blocked',
    reason: 'Famous Egyptian Azan; rights unclear / copyrighted distribution channels; not added.',
  },
  {
    nameEn: 'Sheikh Ali Ahmed Mulla',
    nameAr: 'علي أحمد ملا',
    status: 'blocked',
    reason:
      'Masjid Al-Haram muezzin; sold on commercial music platforms; Archive “Public Domain” tags are not reliable clearance. Islamic Network notes mu’adhin copyright remains.',
  },
  {
    nameEn: 'Sheikh Mishary Rashid Alafasy',
    nameAr: 'مشاري راشد العفاسي',
    status: 'blocked',
    reason: 'Highly recognizable Gulf voice; commercial rights held by publishers; no open redistribution grant verified.',
  },
  {
    nameEn: 'Sheikh Nasser Al-Qatami',
    nameAr: 'ناصر القطامي',
    status: 'blocked',
    reason: 'Famous Haramain-associated voice; no verified CC / commercial-app redistribution license.',
  },
  {
    nameEn: 'Sheikh Yasser Al-Dosari',
    nameAr: 'ياسر الدوسري',
    status: 'blocked',
    reason: 'Famous Haramain voice; commercially distributed; not cleared for self-hosting in apps.',
  },
  {
    nameEn: 'Sheikh Bandar Baleela',
    nameAr: 'بندر بليلة',
    status: 'blocked',
    reason: 'Famous Masjid Al-Haram voice; no verified open license for app redistribution.',
  },
] as const;

/** Curated license-safe Azan catalog (kept + polished for Islamic UX). */
export const AZAN_SOUND_OPTIONS: AzanSoundOption[] = [
  {
    id: 'beautiful_adhan',
    nameEn: 'Beautiful Adhan',
    nameAr: 'أذان جميل',
    descriptionEn: 'Clear, peaceful Adhan — recommended default (fully open CC0 license).',
    descriptionAr: 'أذان واضح وهادئ — الخيار الافتراضي الموصى به (رخصة CC0 مفتوحة بالكامل).',
    muezzinEn: 'Community recording (Adam-synagda)',
    muezzinAr: 'تسجيل مجتمعي (آدم سيناجدا)',
    isFamousVoice: false,
    category: 'community_recording',
    audioUrl: '',
    previewUrl: '',
    mediaFile: 'beautiful_adhan.ogg',
    format: 'ogg',
    provider: 'wikimedia_commons_selfhosted',
    source: 'Wikimedia Commons',
    isDefault: true,
    durationSeconds: null,
    license: {
      spdxOrName: 'CC0-1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      attributionRequired: false,
      attributionText: 'Beautiful adhan.ogg by Adam-synagda (Wikimedia Commons, CC0 1.0)',
      commercialUseAllowed: true,
      sourcePageUrl: 'https://commons.wikimedia.org/wiki/File:Beautiful_adhan.ogg',
    },
    ...openRights(true),
  },
  {
    id: 'hassan_ii_casablanca',
    nameEn: 'Hassan II Mosque Call',
    nameAr: 'نداء مسجد الحسن الثاني',
    descriptionEn: 'Atmospheric field recording of the call to prayer at Hassan II Mosque, Casablanca.',
    descriptionAr: 'تسجيل ميداني لأذان مسجد الحسن الثاني بالدار البيضاء.',
    muezzinEn: 'Field recording — Fraguando',
    muezzinAr: 'تسجيل ميداني — Fraguando',
    locationEn: 'Hassan II Mosque, Casablanca',
    locationAr: 'مسجد الحسن الثاني، الدار البيضاء',
    isFamousVoice: false,
    category: 'mosque_field_recording',
    audioUrl: '',
    previewUrl: '',
    mediaFile: 'hassan_ii_casablanca.mp3',
    format: 'mp3',
    provider: 'wikimedia_commons_selfhosted',
    source: 'Wikimedia Commons',
    durationSeconds: null,
    license: {
      spdxOrName: 'CC-BY-SA-4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      attributionRequired: true,
      attributionText:
        'Llamada a oración Mezquita Hassan II by Fraguando (Wikimedia Commons), CC BY-SA 4.0',
      commercialUseAllowed: true,
      sourcePageUrl:
        'https://commons.wikimedia.org/wiki/File:Llamada_a_oración_Mezquita_Hassan_II.wav',
    },
    ...openRights(true),
  },
  {
    id: 'aaqib_azeez',
    nameEn: 'Adhan — Aaqib Azeez',
    nameAr: 'أذان — عاقب عزيز',
    descriptionEn: 'Clear Adhan recording by Aaqib Azeez (CC BY-SA).',
    descriptionAr: 'تسجيل أذان واضح بصوت عاقب عزيز (CC BY-SA).',
    muezzinEn: 'Aaqib Azeez',
    muezzinAr: 'عاقب عزيز',
    isFamousVoice: false,
    category: 'community_recording',
    audioUrl: '',
    previewUrl: '',
    mediaFile: 'aaqib_azeez.mp3',
    format: 'mp3',
    provider: 'wikimedia_commons_selfhosted',
    source: 'Wikimedia Commons',
    durationSeconds: null,
    license: {
      spdxOrName: 'CC-BY-SA-4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      attributionRequired: true,
      attributionText:
        'The Adhan - Muslim Call to Prayer - Aaqib Azeez.mp3 by Atcovi / Aaqib Azeez (Wikimedia Commons), CC BY-SA 4.0',
      commercialUseAllowed: true,
      sourcePageUrl:
        'https://commons.wikimedia.org/wiki/File:The_Adhan_-_Muslim_Call_to_Prayer_-_Aaqib_Azeez.mp3',
    },
    ...openRights(true),
  },
  {
    id: 'islamic_call_mahfoudou',
    nameEn: 'Islamic Call to Worship',
    nameAr: 'نداء إسلامي للصلاة',
    descriptionEn: 'Full Adhan reading suitable for prayer-time playback.',
    descriptionAr: 'قراءة أذان كاملة مناسبة لوقت الصلاة.',
    muezzinEn: 'Mahfoudou (recording)',
    muezzinAr: 'محفودو (تسجيل)',
    isFamousVoice: false,
    category: 'community_recording',
    audioUrl: '',
    previewUrl: '',
    mediaFile: 'islamic_call_mahfoudou.oga',
    format: 'oga',
    provider: 'wikimedia_commons_selfhosted',
    source: 'Wikimedia Commons',
    durationSeconds: null,
    license: {
      spdxOrName: 'CC-BY-SA-4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      attributionRequired: true,
      attributionText:
        'Islamic call to worship.oga by Mahfoudou (Wikimedia Commons), CC BY-SA 4.0',
      commercialUseAllowed: true,
      sourcePageUrl: 'https://commons.wikimedia.org/wiki/File:Islamic_call_to_worship.oga',
    },
    ...openRights(true),
  },
  {
    id: 'azan_andrewler',
    nameEn: 'Adhan (Andrewler)',
    nameAr: 'أذان (أندرو لير)',
    descriptionEn: 'Community Adhan recording under CC BY-SA 4.0.',
    descriptionAr: 'تسجيل أذان مجتمعي برخصة CC BY-SA 4.0.',
    muezzinEn: 'Andrewler (recording)',
    muezzinAr: 'أندرو لير (تسجيل)',
    isFamousVoice: false,
    category: 'community_recording',
    audioUrl: '',
    previewUrl: '',
    mediaFile: 'azan_andrewler.ogg',
    format: 'ogg',
    provider: 'wikimedia_commons_selfhosted',
    source: 'Wikimedia Commons',
    durationSeconds: null,
    license: {
      spdxOrName: 'CC-BY-SA-4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      attributionRequired: true,
      attributionText:
        'Azan.ogg by Andrewler (Wikimedia Commons), licensed under CC BY-SA 4.0',
      commercialUseAllowed: true,
      sourcePageUrl: 'https://commons.wikimedia.org/wiki/File:Azan.ogg',
    },
    ...openRights(true),
  },
  {
    id: 'adhan_wiki',
    nameEn: 'Simple Sunni Adhan',
    nameAr: 'أذان سنّي بسيط',
    descriptionEn: 'Simple clear Sunni Adhan reading — good for preview and everyday use.',
    descriptionAr: 'قراءة أذان سنّي بسيطة وواضحة — مناسبة للمعاينة والاستخدام اليومي.',
    muezzinEn: 'Jarih (recording)',
    muezzinAr: 'جاريه (تسجيل)',
    isFamousVoice: false,
    category: 'community_recording',
    audioUrl: '',
    previewUrl: '',
    mediaFile: 'adhan_wiki.oga',
    format: 'oga',
    provider: 'wikimedia_commons_selfhosted',
    source: 'Wikimedia Commons',
    durationSeconds: null,
    license: {
      spdxOrName: 'CC-BY-SA-3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      attributionRequired: true,
      attributionText:
        'Adhan wiki.oga by Jarih (Wikimedia Commons), licensed under CC BY-SA 3.0',
      commercialUseAllowed: true,
      sourcePageUrl: 'https://commons.wikimedia.org/wiki/File:Adhan_wiki.oga',
    },
    ...openRights(true),
  },
  {
    id: 'adhan_aishatu',
    nameEn: 'Adhan (Aishatu)',
    nameAr: 'أذان (عائشة)',
    descriptionEn: 'Short Adhan announcement recording (CC0).',
    descriptionAr: 'تسجيل قصير لإعلان الأذان (CC0).',
    muezzinEn: 'Aishatu98 (recording)',
    muezzinAr: 'عائشة (تسجيل)',
    isFamousVoice: false,
    category: 'community_recording',
    audioUrl: '',
    previewUrl: '',
    mediaFile: 'adhan_aishatu.ogg',
    format: 'ogg',
    provider: 'wikimedia_commons_selfhosted',
    source: 'Wikimedia Commons',
    durationSeconds: null,
    license: {
      spdxOrName: 'CC0-1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      attributionRequired: false,
      attributionText: 'Adhan.ogg by Aishatu98 (Wikimedia Commons, CC0 1.0)',
      commercialUseAllowed: true,
      sourcePageUrl: 'https://commons.wikimedia.org/wiki/File:Adhan.ogg',
    },
    ...openRights(true),
  },
];

/**
 * Calm, spiritual notification tones for an Islamic / Qur’an app.
 * Generic game/UI beeps removed from the live catalog (legacy ids still alias here).
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
    ...openRights(true),
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
    ...openRights(true),
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
    ...openRights(true),
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
    ...openRights(true),
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
    ...openRights(true),
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
    ...openRights(true),
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

export const DEFAULT_AZAN_SOUND_ID = 'beautiful_adhan';
export const DEFAULT_NOTIFICATION_SOUND_ID = 'soft_chime';

const AZAN_ID_ALIASES: Record<string, string> = {
  beautiful_adhan: 'beautiful_adhan',
  makkah: 'beautiful_adhan',
  azan1: 'beautiful_adhan',
  madinah: 'adhan_aishatu',
  madina: 'adhan_aishatu',
  azan2: 'adhan_aishatu',
  aqsa: 'azan_andrewler',
  al_aqsa: 'azan_andrewler',
  azan3: 'azan_andrewler',
  egypt: 'aaqib_azeez',
  egyptian: 'aaqib_azeez',
  cairo: 'aaqib_azeez',
  azan4: 'aaqib_azeez',
  turkey: 'islamic_call_mahfoudou',
  turkish: 'islamic_call_mahfoudou',
  azan5: 'islamic_call_mahfoudou',
  soft: 'adhan_wiki',
  gentle: 'adhan_wiki',
  azan6: 'adhan_wiki',
  abdul_basit: 'hassan_ii_casablanca',
  abdulbasit: 'hassan_ii_casablanca',
  azan7: 'hassan_ii_casablanca',
  mishary: 'azan_andrewler',
  alafasy: 'azan_andrewler',
  azan8: 'azan_andrewler',
  cairo_fajr: 'beautiful_adhan',
  makkah_fajr: 'beautiful_adhan',
  yasser_dosari: 'aaqib_azeez',
  dosari: 'aaqib_azeez',
  ali_mulla: 'hassan_ii_casablanca',
  toubar: 'beautiful_adhan',
  refaat: 'beautiful_adhan',
  azan_andrewler: 'azan_andrewler',
  islamic_call_mahfoudou: 'islamic_call_mahfoudou',
  adhan_wiki: 'adhan_wiki',
  adhan_aishatu: 'adhan_aishatu',
  aaqib_azeez: 'aaqib_azeez',
  hassan_ii_casablanca: 'hassan_ii_casablanca',
};

/** Legacy / removed generic tones → calm Islamic-appropriate options. */
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
  preferredApiEvaluated: 'Al Furqan Athan API (alfurqan.online)',
  preferredApiDecision: 'rejected_for_recording_rights',
  preferredApiReason:
    'API is free/MIT, but athan files are sourced from Assabile.com without a verified per-recording redistribution license for commercial app use.',
  famousVoicesPolicy:
    'Famous Haramain / Egyptian muezzin recordings are not shipped until written redistribution + commercial-app rights are obtained. Keep verified CC Commons options meanwhile.',
  azanProvider: 'wikimedia_commons_selfhosted',
  notificationProvider: 'freesound_selfhosted',
  delivery:
    'Audio bytes are self-hosted under /api/v1/azan/media/:file. License metadata cites original Commons/Freesound pages.',
  policy:
    'Only expose recordings with explicit CC0 / CC BY / CC BY-SA (or equivalent clear grant). Prefer authentic Islamic UX without sacrificing licensing safety.',
} as const;

export const AZAN_MEDIA_FILES: Record<
  string,
  { relativePath: string; contentType: string }
> = {
  'beautiful_adhan.ogg': { relativePath: 'azan/beautiful_adhan.ogg', contentType: 'audio/ogg' },
  'adhan_aishatu.ogg': { relativePath: 'azan/adhan_aishatu.ogg', contentType: 'audio/ogg' },
  'azan_andrewler.ogg': { relativePath: 'azan/azan_andrewler.ogg', contentType: 'audio/ogg' },
  'islamic_call_mahfoudou.oga': {
    relativePath: 'azan/islamic_call_mahfoudou.oga',
    contentType: 'audio/ogg',
  },
  'adhan_wiki.oga': { relativePath: 'azan/adhan_wiki.oga', contentType: 'audio/ogg' },
  'aaqib_azeez.mp3': { relativePath: 'azan/aaqib_azeez.mp3', contentType: 'audio/mpeg' },
  'hassan_ii_casablanca.mp3': {
    relativePath: 'azan/hassan_ii_casablanca.mp3',
    contentType: 'audio/mpeg',
  },
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
