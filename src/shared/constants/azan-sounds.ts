/**
 * Production-safe Azan + notification sound catalogs (license-verified).
 *
 * REJECTED for unclear / unsuitable redistribution rights (do not re-add without proof):
 * - IslamCan Adhan MP3s — no clear redistribution license found
 * - Kiwifu/adhan-mp3 — no LICENSE file; “free for apps” claim is not a clear CC grant
 * - Al Furqan Athan API — free API (MIT code) but audio sourced from Assabile.com;
 *   Assabile recording rights are NOT verified as redistributable for commercial apps
 * - Google Actions sound library — Terms restrict use to Actions on Google only
 * - Commons “Call to prayer by Sabah Fakhry.mp3” — tagged Public domain, but provenance
 *   is uncertain for a famous commercial recording; excluded under clear-permission rule
 *
 * ACCEPTED sources (explicit permissive licenses verified via Wikimedia / Freesound pages):
 * - Wikimedia Commons CC0 / CC BY-SA 4.0 Adhan recordings
 * - Freesound CC0 / CC BY notification tones (preview CDN URLs)
 *
 * Quran audio remains separate: /quran/audio (Quran Foundation).
 */

export type AudioLicense = {
  spdxOrName: 'CC0-1.0' | 'CC-BY-SA-4.0' | 'CC-BY-4.0' | 'CC-BY-3.0' | 'none';
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
  muezzinEn: string;
  muezzinAr: string;
  locationEn?: string;
  locationAr?: string;
  audioUrl: string;
  format: 'mp3' | 'ogg' | 'oga';
  provider: 'wikimedia_commons';
  license: AudioLicense;
  isDefault?: boolean;
};

export type NotificationSoundOption = {
  id: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  /** null = silent / vibration-only */
  audioUrl: string | null;
  format: 'mp3' | 'none';
  provider: 'freesound' | 'none';
  license: AudioLicense;
  isDefault?: boolean;
};

const COMMONS = 'https://upload.wikimedia.org/wikipedia/commons';
const FREESOUND_CDN = 'https://cdn.freesound.org/previews';

/** Curated license-safe Azan catalog (multiple options). */
export const AZAN_SOUND_OPTIONS: AzanSoundOption[] = [
  {
    id: 'beautiful_adhan',
    nameEn: 'Beautiful Adhan (CC0)',
    nameAr: 'أذان جميل (CC0)',
    muezzinEn: 'Adam-synagda (recording)',
    muezzinAr: 'آدم سيناجدا (تسجيل)',
    audioUrl: `${COMMONS}/b/b0/Beautiful_adhan.ogg`,
    format: 'ogg',
    provider: 'wikimedia_commons',
    isDefault: true,
    license: {
      spdxOrName: 'CC0-1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      attributionRequired: false,
      attributionText: 'Beautiful adhan.ogg by Adam-synagda (Wikimedia Commons, CC0 1.0)',
      commercialUseAllowed: true,
      sourcePageUrl: 'https://commons.wikimedia.org/wiki/File:Beautiful_adhan.ogg',
    },
  },
  {
    id: 'azan_andrewler',
    nameEn: 'Adhan (Andrewler)',
    nameAr: 'أذان (أندرو لير)',
    muezzinEn: 'Andrewler (recording)',
    muezzinAr: 'أندرو لير (تسجيل)',
    audioUrl: `${COMMONS}/8/86/Azan.ogg`,
    format: 'ogg',
    provider: 'wikimedia_commons',
    license: {
      spdxOrName: 'CC-BY-SA-4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      attributionRequired: true,
      attributionText:
        'Azan.ogg by Andrewler (Wikimedia Commons), licensed under CC BY-SA 4.0',
      commercialUseAllowed: true,
      sourcePageUrl: 'https://commons.wikimedia.org/wiki/File:Azan.ogg',
    },
  },
  {
    id: 'aaqib_azeez',
    nameEn: 'Adhan — Aaqib Azeez',
    nameAr: 'أذان — عاقب عزيز',
    muezzinEn: 'Aaqib Azeez',
    muezzinAr: 'عاقب عزيز',
    audioUrl: `${COMMONS}/7/7d/The_Adhan_-_Muslim_Call_to_Prayer_-_Aaqib_Azeez.mp3`,
    format: 'mp3',
    provider: 'wikimedia_commons',
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
  },
  {
    id: 'islamic_call_mahfoudou',
    nameEn: 'Islamic call to worship',
    nameAr: 'نداء إسلامي للصلاة',
    muezzinEn: 'Mahfoudou (recording)',
    muezzinAr: 'محفودو (تسجيل)',
    audioUrl: `${COMMONS}/d/d2/Islamic_call_to_worship.oga`,
    format: 'oga',
    provider: 'wikimedia_commons',
    license: {
      spdxOrName: 'CC-BY-SA-4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      attributionRequired: true,
      attributionText:
        'Islamic call to worship.oga by Mahfoudou (Wikimedia Commons), CC BY-SA 4.0',
      commercialUseAllowed: true,
      sourcePageUrl: 'https://commons.wikimedia.org/wiki/File:Islamic_call_to_worship.oga',
    },
  },
];

/** Short tones for pre-reminder / prayer notification (license-safe). */
export const NOTIFICATION_SOUND_OPTIONS: NotificationSoundOption[] = [
  {
    id: 'soft_chime',
    nameEn: 'Soft chime',
    nameAr: 'نغمة ناعمة',
    descriptionEn: 'Short UI notification (CC0)',
    descriptionAr: 'تنبيه واجهة قصير (CC0)',
    audioUrl: `${FREESOUND_CDN}/750/750607_11532701-hq.mp3`,
    format: 'mp3',
    provider: 'freesound',
    isDefault: true,
    license: {
      spdxOrName: 'CC0-1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      attributionRequired: false,
      attributionText:
        'Notification Sound 1 by deadrobotmusic (Freesound), CC0 1.0 — https://freesound.org/s/750607/',
      commercialUseAllowed: true,
      sourcePageUrl: 'https://freesound.org/people/deadrobotmusic/sounds/750607/',
    },
  },
  {
    id: 'ui_alert',
    nameEn: 'UI alert',
    nameAr: 'تنبيه واجهة',
    descriptionEn: 'Compact UI alert tone (CC0)',
    descriptionAr: 'نغمة تنبيه واجهة قصيرة (CC0)',
    audioUrl: `${FREESOUND_CDN}/243/243020_4284968-hq.mp3`,
    format: 'mp3',
    provider: 'freesound',
    license: {
      spdxOrName: 'CC0-1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      attributionRequired: false,
      attributionText:
        'UI sound by plasterbrain (Freesound), CC0 1.0 — https://freesound.org/s/243020/',
      commercialUseAllowed: true,
      sourcePageUrl: 'https://freesound.org/people/plasterbrain/sounds/243020/',
    },
  },
  {
    id: 'bell_chime',
    nameEn: 'Bell chime',
    nameAr: 'جرس',
    descriptionEn: 'Bell-style alert (CC BY — attribution required)',
    descriptionAr: 'تنبيه جرسي (CC BY — يلزم ذكر المصدر)',
    audioUrl: `${FREESOUND_CDN}/411/411089_5121236-hq.mp3`,
    format: 'mp3',
    provider: 'freesound',
    license: {
      spdxOrName: 'CC-BY-4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      attributionRequired: true,
      attributionText:
        'Bell / alert sound by InspectorJ (Freesound), CC BY — https://freesound.org/s/411089/',
      commercialUseAllowed: true,
      sourcePageUrl: 'https://freesound.org/people/InspectorJ/sounds/411089/',
    },
  },
  {
    id: 'silent',
    nameEn: 'Silent',
    nameAr: 'صامت',
    descriptionEn: 'No sound (vibration only if enabled)',
    descriptionAr: 'بدون صوت (اهتزاز فقط إن كان مفعلاً)',
    audioUrl: null,
    format: 'none',
    provider: 'none',
    license: {
      spdxOrName: 'none',
      licenseUrl: null,
      attributionRequired: false,
      attributionText: 'No audio',
      commercialUseAllowed: true,
      sourcePageUrl: '',
    },
  },
];

export const DEFAULT_AZAN_SOUND_ID = 'beautiful_adhan';
export const DEFAULT_NOTIFICATION_SOUND_ID = 'soft_chime';

/**
 * Legacy preference ids → current license-safe ids.
 * Old IslamCan/Kiwifu ids map to the CC0 default (not claiming equivalence of recording).
 */
const AZAN_ID_ALIASES: Record<string, string> = {
  beautiful_adhan: 'beautiful_adhan',
  makkah: 'beautiful_adhan',
  azan1: 'beautiful_adhan',
  madinah: 'beautiful_adhan',
  madina: 'beautiful_adhan',
  azan2: 'beautiful_adhan',
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
  soft: 'beautiful_adhan',
  gentle: 'beautiful_adhan',
  azan6: 'beautiful_adhan',
  abdul_basit: 'aaqib_azeez',
  abdulbasit: 'aaqib_azeez',
  azan7: 'aaqib_azeez',
  mishary: 'azan_andrewler',
  alafasy: 'azan_andrewler',
  azan8: 'azan_andrewler',
  cairo_fajr: 'beautiful_adhan',
  makkah_fajr: 'beautiful_adhan',
  yasser_dosari: 'aaqib_azeez',
  dosari: 'aaqib_azeez',
  azan_andrewler: 'azan_andrewler',
  aaqib_azeez: 'aaqib_azeez',
  islamic_call_mahfoudou: 'islamic_call_mahfoudou',
};

const NOTIFICATION_ID_ALIASES: Record<string, string> = {
  soft_chime: 'soft_chime',
  beep_short: 'soft_chime',
  medium_bell: 'bell_chime',
  dinner_bell: 'bell_chime',
  digital_watch: 'ui_alert',
  alarm_clock: 'ui_alert',
  bugle: 'ui_alert',
  phone_ring: 'ui_alert',
  ui_alert: 'ui_alert',
  bell_chime: 'bell_chime',
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
  azanProvider: 'wikimedia_commons',
  notificationProvider: 'freesound',
  policy:
    'Only expose recordings with explicit CC0 / CC BY / CC BY-SA (or equivalent clear grant). Keep attribution fields for Flutter UI.',
} as const;
