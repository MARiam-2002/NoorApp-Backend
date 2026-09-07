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
 * - Commons “Maliki doctrine.oga” — lecture about Adhan rules, not an Adhan recording
 *
 * ACCEPTED sources (explicit permissive licenses verified on file/sound pages):
 * - Wikimedia Commons CC0 / CC BY-SA Adhan recordings (self-hosted under assets/azan/)
 * - Freesound CC0 / CC BY notification tones (self-hosted under assets/notification/)
 *
 * Audio bytes are served from this Backend (`GET /azan/media/:file`) to avoid Wikimedia
 * hotlink rate-limits. Attribution / license metadata still points at original source pages.
 *
 * Quran audio remains separate: /quran/audio (Quran Foundation).
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

export type AzanSoundOption = {
  id: string;
  nameEn: string;
  nameAr: string;
  muezzinEn: string;
  muezzinAr: string;
  locationEn?: string;
  locationAr?: string;
  /** Absolute URL filled at response time by the audio service. */
  audioUrl: string;
  /** Relative path under assets/ (served via /azan/media/:file). */
  mediaFile: string;
  format: 'mp3' | 'ogg' | 'oga';
  provider: 'wikimedia_commons_selfhosted';
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
  mediaFile: string | null;
  format: 'mp3' | 'none';
  provider: 'freesound_selfhosted' | 'none';
  license: AudioLicense;
  isDefault?: boolean;
};

/** Curated license-safe Azan catalog (multiple options; self-hosted). */
export const AZAN_SOUND_OPTIONS: AzanSoundOption[] = [
  {
    id: 'beautiful_adhan',
    nameEn: 'Beautiful Adhan (CC0)',
    nameAr: 'أذان جميل (CC0)',
    muezzinEn: 'Adam-synagda (recording)',
    muezzinAr: 'آدم سيناجدا (تسجيل)',
    audioUrl: '',
    mediaFile: 'beautiful_adhan.ogg',
    format: 'ogg',
    provider: 'wikimedia_commons_selfhosted',
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
    id: 'adhan_aishatu',
    nameEn: 'Adhan (Aishatu98)',
    nameAr: 'أذان (عائشة)',
    muezzinEn: 'Aishatu98 (recording)',
    muezzinAr: 'عائشة (تسجيل)',
    audioUrl: '',
    mediaFile: 'adhan_aishatu.ogg',
    format: 'ogg',
    provider: 'wikimedia_commons_selfhosted',
    license: {
      spdxOrName: 'CC0-1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      attributionRequired: false,
      attributionText: 'Adhan.ogg by Aishatu98 (Wikimedia Commons, CC0 1.0)',
      commercialUseAllowed: true,
      sourcePageUrl: 'https://commons.wikimedia.org/wiki/File:Adhan.ogg',
    },
  },
  {
    id: 'azan_andrewler',
    nameEn: 'Adhan (Andrewler)',
    nameAr: 'أذان (أندرو لير)',
    muezzinEn: 'Andrewler (recording)',
    muezzinAr: 'أندرو لير (تسجيل)',
    audioUrl: '',
    mediaFile: 'azan_andrewler.ogg',
    format: 'ogg',
    provider: 'wikimedia_commons_selfhosted',
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
    id: 'islamic_call_mahfoudou',
    nameEn: 'Islamic call to worship',
    nameAr: 'نداء إسلامي للصلاة',
    muezzinEn: 'Mahfoudou (recording)',
    muezzinAr: 'محفودو (تسجيل)',
    audioUrl: '',
    mediaFile: 'islamic_call_mahfoudou.oga',
    format: 'oga',
    provider: 'wikimedia_commons_selfhosted',
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
  {
    id: 'adhan_wiki',
    nameEn: 'Adhan (simple Sunni reading)',
    nameAr: 'أذان (قراءة بسيطة)',
    muezzinEn: 'Jarih (recording)',
    muezzinAr: 'جاريه (تسجيل)',
    audioUrl: '',
    mediaFile: 'adhan_wiki.oga',
    format: 'oga',
    provider: 'wikimedia_commons_selfhosted',
    license: {
      spdxOrName: 'CC-BY-SA-3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      attributionRequired: true,
      attributionText:
        'Adhan wiki.oga by Jarih (Wikimedia Commons), licensed under CC BY-SA 3.0',
      commercialUseAllowed: true,
      sourcePageUrl: 'https://commons.wikimedia.org/wiki/File:Adhan_wiki.oga',
    },
  },
  {
    id: 'aaqib_azeez',
    nameEn: 'Adhan — Aaqib Azeez',
    nameAr: 'أذان — عاقب عزيز',
    muezzinEn: 'Aaqib Azeez',
    muezzinAr: 'عاقب عزيز',
    audioUrl: '',
    mediaFile: 'aaqib_azeez.mp3',
    format: 'mp3',
    provider: 'wikimedia_commons_selfhosted',
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
    id: 'hassan_ii_casablanca',
    nameEn: 'Hassan II Mosque call (Casablanca)',
    nameAr: 'نداء مسجد الحسن الثاني (الدار البيضاء)',
    muezzinEn: 'Field recording — Fraguando',
    muezzinAr: 'تسجيل ميداني — Fraguando',
    locationEn: 'Hassan II Mosque, Casablanca',
    locationAr: 'مسجد الحسن الثاني، الدار البيضاء',
    audioUrl: '',
    mediaFile: 'hassan_ii_casablanca.mp3',
    format: 'mp3',
    provider: 'wikimedia_commons_selfhosted',
    license: {
      spdxOrName: 'CC-BY-SA-4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      attributionRequired: true,
      attributionText:
        'Llamada a oración Mezquita Hassan II.wav by Fraguando (Wikimedia Commons), CC BY-SA 4.0 — self-hosted Commons MP3 transcode',
      commercialUseAllowed: true,
      sourcePageUrl:
        'https://commons.wikimedia.org/wiki/File:Llamada_a_oración_Mezquita_Hassan_II.wav',
    },
  },
];

/** Short tones for pre-reminder / prayer notification (license-safe, self-hosted). */
export const NOTIFICATION_SOUND_OPTIONS: NotificationSoundOption[] = [
  {
    id: 'soft_chime',
    nameEn: 'Soft chime',
    nameAr: 'نغمة ناعمة',
    descriptionEn: 'Short UI notification (CC0)',
    descriptionAr: 'تنبيه واجهة قصير (CC0)',
    audioUrl: '',
    mediaFile: 'soft_chime.mp3',
    format: 'mp3',
    provider: 'freesound_selfhosted',
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
    audioUrl: '',
    mediaFile: 'ui_alert.mp3',
    format: 'mp3',
    provider: 'freesound_selfhosted',
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
    id: 'notify_beep',
    nameEn: 'Notify beep',
    nameAr: 'صفير تنبيه',
    descriptionEn: 'Generic notification beep (CC0)',
    descriptionAr: 'صفير تنبيه عام (CC0)',
    audioUrl: '',
    mediaFile: 'notify_beep.mp3',
    format: 'mp3',
    provider: 'freesound_selfhosted',
    license: {
      spdxOrName: 'CC0-1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      attributionRequired: false,
      attributionText:
        'Notification 1 by chungus43A (Freesound), CC0 1.0 — https://freesound.org/s/580789/',
      commercialUseAllowed: true,
      sourcePageUrl: 'https://freesound.org/people/chungus43A/sounds/580789/',
    },
  },
  {
    id: 'notify_punchy',
    nameEn: 'Punchy notify',
    nameAr: 'تنبيه سريع',
    descriptionEn: 'Short punchy notification (CC0)',
    descriptionAr: 'تنبيه قصير حاد (CC0)',
    audioUrl: '',
    mediaFile: 'notify_punchy.mp3',
    format: 'mp3',
    provider: 'freesound_selfhosted',
    license: {
      spdxOrName: 'CC0-1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      attributionRequired: false,
      attributionText:
        'Notification by Fupicat (Freesound), CC0 1.0 — https://freesound.org/s/538149/',
      commercialUseAllowed: true,
      sourcePageUrl: 'https://freesound.org/people/Fupicat/sounds/538149/',
    },
  },
  {
    id: 'xylophone_chime',
    nameEn: 'Xylophone chime',
    nameAr: 'نغمة إكسيليفون',
    descriptionEn: 'Soft xylophone-style chime (CC0)',
    descriptionAr: 'نغمة إكسيليفون ناعمة (CC0)',
    audioUrl: '',
    mediaFile: 'xylophone_chime.mp3',
    format: 'mp3',
    provider: 'freesound_selfhosted',
    license: {
      spdxOrName: 'CC0-1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      attributionRequired: false,
      attributionText:
        'notify3.wav by Mihacappy (Freesound), CC0 1.0 — https://freesound.org/s/850177/',
      commercialUseAllowed: true,
      sourcePageUrl: 'https://freesound.org/people/Mihacappy/sounds/850177/',
    },
  },
  {
    id: 'gui_notify',
    nameEn: 'GUI notify',
    nameAr: 'تنبيه واجهة رسومية',
    descriptionEn: 'Designed GUI notification (CC0)',
    descriptionAr: 'تنبيه واجهة مصمم (CC0)',
    audioUrl: '',
    mediaFile: 'gui_notify.mp3',
    format: 'mp3',
    provider: 'freesound_selfhosted',
    license: {
      spdxOrName: 'CC0-1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      attributionRequired: false,
      attributionText:
        'SFX-Notification3 by soundandmelodies (Freesound), CC0 1.0 — https://freesound.org/s/776183/',
      commercialUseAllowed: true,
      sourcePageUrl: 'https://freesound.org/people/soundandmelodies/sounds/776183/',
    },
  },
  {
    id: 'digital_blip',
    nameEn: 'Digital blip',
    nameAr: 'نبضة رقمية',
    descriptionEn: 'Short digital hint blip (CC0)',
    descriptionAr: 'نبضة رقمية قصيرة (CC0)',
    audioUrl: '',
    mediaFile: 'digital_blip.mp3',
    format: 'mp3',
    provider: 'freesound_selfhosted',
    license: {
      spdxOrName: 'CC0-1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      attributionRequired: false,
      attributionText:
        'hint.wav by dland (Freesound), CC0 1.0 — https://freesound.org/s/320181/',
      commercialUseAllowed: true,
      sourcePageUrl: 'https://freesound.org/people/dland/sounds/320181/',
    },
  },
  {
    id: 'game_notify',
    nameEn: 'Space beep',
    nameAr: 'صفير فضائي',
    descriptionEn: 'Space-button style beep (CC0)',
    descriptionAr: 'صفير بأسلوب أزرار فضائية (CC0)',
    audioUrl: '',
    mediaFile: 'game_notify.mp3',
    format: 'mp3',
    provider: 'freesound_selfhosted',
    license: {
      spdxOrName: 'CC0-1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      attributionRequired: false,
      attributionText:
        'Beep Space Button by GameAudio (Freesound), CC0 1.0 — https://freesound.org/s/220206/',
      commercialUseAllowed: true,
      sourcePageUrl: 'https://freesound.org/people/GameAudio/sounds/220206/',
    },
  },
  {
    id: 'sparkle_tone',
    nameEn: 'Success sparkle',
    nameAr: 'نغمة نجاح',
    descriptionEn: 'Success / sparkle tone (CC0)',
    descriptionAr: 'نغمة نجاح / بريق (CC0)',
    audioUrl: '',
    mediaFile: 'sparkle_tone.mp3',
    format: 'mp3',
    provider: 'freesound_selfhosted',
    license: {
      spdxOrName: 'CC0-1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      attributionRequired: false,
      attributionText:
        'Powerup/success.wav by GabrielAraujo (Freesound), CC0 1.0 — https://freesound.org/s/242501/',
      commercialUseAllowed: true,
      sourcePageUrl: 'https://freesound.org/people/GabrielAraujo/sounds/242501/',
    },
  },
  {
    id: 'message_pop',
    nameEn: 'Message pop',
    nameAr: 'ظهور رسالة',
    descriptionEn: 'Got-item / message pop (CC0)',
    descriptionAr: 'نغمة ظهور عنصر / رسالة (CC0)',
    audioUrl: '',
    mediaFile: 'message_pop.mp3',
    format: 'mp3',
    provider: 'freesound_selfhosted',
    license: {
      spdxOrName: 'CC0-1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      attributionRequired: false,
      attributionText:
        'gotItem.mp3 by Kastenfrosch (Freesound), CC0 1.0 — https://freesound.org/s/162476/',
      commercialUseAllowed: true,
      sourcePageUrl: 'https://freesound.org/people/Kastenfrosch/sounds/162476/',
    },
  },
  {
    id: 'bell_chime',
    nameEn: 'Bell chime',
    nameAr: 'جرس',
    descriptionEn: 'Bell-style alert (CC BY — attribution required)',
    descriptionAr: 'تنبيه جرسي (CC BY — يلزم ذكر المصدر)',
    audioUrl: '',
    mediaFile: 'bell_chime.mp3',
    format: 'mp3',
    provider: 'freesound_selfhosted',
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
    id: 'dingaling',
    nameEn: 'Dingaling',
    nameAr: 'رنين خفيف',
    descriptionEn: 'Short SMS-style ding (CC BY — attribution required)',
    descriptionAr: 'رنين قصير بأسلوب الرسائل (CC BY — يلزم ذكر المصدر)',
    audioUrl: '',
    mediaFile: 'dingaling.mp3',
    format: 'mp3',
    provider: 'freesound_selfhosted',
    license: {
      spdxOrName: 'CC-BY-4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      attributionRequired: true,
      attributionText:
        'dingaling by morrisjm based on RSilveira_88 (Freesound), CC BY — https://freesound.org/s/268756/',
      commercialUseAllowed: true,
      sourcePageUrl: 'https://freesound.org/people/morrisjm/sounds/268756/',
    },
  },
  {
    id: 'silent',
    nameEn: 'Silent',
    nameAr: 'صامت',
    descriptionEn: 'No sound (vibration only if enabled)',
    descriptionAr: 'بدون صوت (اهتزاز فقط إن كان مفعلاً)',
    audioUrl: null,
    mediaFile: null,
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
 * Old IslamCan/Kiwifu ids map to license-safe options (not claiming recording equivalence).
 */
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
  azan_andrewler: 'azan_andrewler',
  islamic_call_mahfoudou: 'islamic_call_mahfoudou',
  adhan_wiki: 'adhan_wiki',
  adhan_aishatu: 'adhan_aishatu',
  aaqib_azeez: 'aaqib_azeez',
  hassan_ii_casablanca: 'hassan_ii_casablanca',
};

const NOTIFICATION_ID_ALIASES: Record<string, string> = {
  soft_chime: 'soft_chime',
  beep_short: 'notify_beep',
  medium_bell: 'bell_chime',
  dinner_bell: 'bell_chime',
  digital_watch: 'digital_blip',
  alarm_clock: 'game_notify',
  bugle: 'gui_notify',
  phone_ring: 'dingaling',
  ui_alert: 'ui_alert',
  bell_chime: 'bell_chime',
  notify_beep: 'notify_beep',
  notify_punchy: 'notify_punchy',
  xylophone_chime: 'xylophone_chime',
  gui_notify: 'gui_notify',
  digital_blip: 'digital_blip',
  game_notify: 'game_notify',
  sparkle_tone: 'sparkle_tone',
  message_pop: 'message_pop',
  dingaling: 'dingaling',
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
  azanProvider: 'wikimedia_commons_selfhosted',
  notificationProvider: 'freesound_selfhosted',
  delivery:
    'Audio bytes are self-hosted under /api/v1/azan/media/:file (license metadata still cites original Commons/Freesound pages).',
  policy:
    'Only expose recordings with explicit CC0 / CC BY / CC BY-SA (or equivalent clear grant). Keep attribution fields for Flutter UI.',
} as const;

/** Allowed media filenames for GET /azan/media/:file (prevent path traversal). */
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
  'ui_alert.mp3': { relativePath: 'notification/ui_alert.mp3', contentType: 'audio/mpeg' },
  'notify_beep.mp3': { relativePath: 'notification/notify_beep.mp3', contentType: 'audio/mpeg' },
  'notify_punchy.mp3': {
    relativePath: 'notification/notify_punchy.mp3',
    contentType: 'audio/mpeg',
  },
  'xylophone_chime.mp3': {
    relativePath: 'notification/xylophone_chime.mp3',
    contentType: 'audio/mpeg',
  },
  'gui_notify.mp3': { relativePath: 'notification/gui_notify.mp3', contentType: 'audio/mpeg' },
  'digital_blip.mp3': {
    relativePath: 'notification/digital_blip.mp3',
    contentType: 'audio/mpeg',
  },
  'game_notify.mp3': { relativePath: 'notification/game_notify.mp3', contentType: 'audio/mpeg' },
  'sparkle_tone.mp3': {
    relativePath: 'notification/sparkle_tone.mp3',
    contentType: 'audio/mpeg',
  },
  'message_pop.mp3': { relativePath: 'notification/message_pop.mp3', contentType: 'audio/mpeg' },
  'bell_chime.mp3': { relativePath: 'notification/bell_chime.mp3', contentType: 'audio/mpeg' },
  'dingaling.mp3': { relativePath: 'notification/dingaling.mp3', contentType: 'audio/mpeg' },
};
