/**
 * Azan + prayer-notification sound catalogs.
 *
 * Azan source (verified 2026): IslamCan free Adhan MP3s
 *   https://www.islamcan.com/audio/adhan/azan{N}.mp3
 *
 * Supplemental Azan (verified 2026): Kiwifu/adhan-mp3 via jsDelivr CDN
 *   https://cdn.jsdelivr.net/gh/Kiwifu/adhan-mp3@main/...
 *
 * Notification tones (verified 2026): Google Actions free sound library
 *   https://actions.google.com/sounds/v1/...
 *
 * Quran audio is NOT here — keep using /quran/audio (Quran Foundation).
 */

export type AzanSoundOption = {
  id: string;
  nameEn: string;
  nameAr: string;
  muezzinEn: string;
  muezzinAr: string;
  locationEn?: string;
  locationAr?: string;
  audioUrl: string;
  format: 'mp3';
  provider: 'islamcan' | 'kiwifu_jsdelivr';
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
  format: 'ogg' | 'none';
  provider: 'google_actions' | 'none';
  isDefault?: boolean;
};

const ISLAMCAN_BASE = 'https://www.islamcan.com/audio/adhan';
const KIWIFU_BASE = 'https://cdn.jsdelivr.net/gh/Kiwifu/adhan-mp3@main';
const GOOGLE_SOUNDS = 'https://actions.google.com/sounds/v1';

function kiwifu(file: string): string {
  return `${KIWIFU_BASE}/${encodeURIComponent(file)}`;
}

/** Curated Azan catalog — multiple options, not a single hard-coded file. */
export const AZAN_SOUND_OPTIONS: AzanSoundOption[] = [
  {
    id: 'makkah',
    nameEn: 'Masjid al-Haram (Makkah)',
    nameAr: 'المسجد الحرام (مكة)',
    muezzinEn: 'Sheikh Ali Ahmad Mulla',
    muezzinAr: 'علي أحمد ملا',
    locationEn: 'Makkah, Saudi Arabia',
    locationAr: 'مكة المكرمة',
    audioUrl: `${ISLAMCAN_BASE}/azan1.mp3`,
    format: 'mp3',
    provider: 'islamcan',
    isDefault: true,
  },
  {
    id: 'madinah',
    nameEn: 'Masjid an-Nabawi (Madinah)',
    nameAr: 'المسجد النبوي (المدينة)',
    muezzinEn: 'Traditional Madinah Adhan',
    muezzinAr: 'أذان المدينة التقليدي',
    locationEn: 'Madinah, Saudi Arabia',
    locationAr: 'المدينة المنورة',
    audioUrl: `${ISLAMCAN_BASE}/azan2.mp3`,
    format: 'mp3',
    provider: 'islamcan',
  },
  {
    id: 'aqsa',
    nameEn: 'Al-Aqsa Mosque (Jerusalem)',
    nameAr: 'المسجد الأقصى (القدس)',
    muezzinEn: 'Al-Aqsa Adhan',
    muezzinAr: 'أذان الأقصى',
    locationEn: 'Jerusalem, Palestine',
    locationAr: 'القدس، فلسطين',
    audioUrl: `${ISLAMCAN_BASE}/azan3.mp3`,
    format: 'mp3',
    provider: 'islamcan',
  },
  {
    id: 'egypt',
    nameEn: 'Egyptian Adhan',
    nameAr: 'الأذان المصري',
    muezzinEn: 'Traditional Cairo style',
    muezzinAr: 'أسلوب القاهرة التقليدي',
    locationEn: 'Egypt',
    locationAr: 'مصر',
    audioUrl: `${ISLAMCAN_BASE}/azan4.mp3`,
    format: 'mp3',
    provider: 'islamcan',
  },
  {
    id: 'turkey',
    nameEn: 'Turkish Adhan',
    nameAr: 'الأذان التركي',
    muezzinEn: 'Saba melodic style',
    muezzinAr: 'الطابع التركي',
    locationEn: 'Turkey',
    locationAr: 'تركيا',
    audioUrl: `${ISLAMCAN_BASE}/azan5.mp3`,
    format: 'mp3',
    provider: 'islamcan',
  },
  {
    id: 'soft',
    nameEn: 'Soft Adhan',
    nameAr: 'أذان هادئ',
    muezzinEn: 'Gentle style',
    muezzinAr: 'أسلوب هادئ',
    audioUrl: `${ISLAMCAN_BASE}/azan6.mp3`,
    format: 'mp3',
    provider: 'islamcan',
  },
  {
    id: 'abdul_basit',
    nameEn: 'Abdul Basit Adhan',
    nameAr: 'أذان عبد الباسط',
    muezzinEn: 'Sheikh Abdul Basit Abdusamad',
    muezzinAr: 'الشيخ عبد الباسط عبد الصمد',
    locationEn: 'Egypt',
    locationAr: 'مصر',
    audioUrl: `${ISLAMCAN_BASE}/azan7.mp3`,
    format: 'mp3',
    provider: 'islamcan',
  },
  {
    id: 'mishary',
    nameEn: 'Mishary Al-Afasy Adhan',
    nameAr: 'أذان مشاري العفاسي',
    muezzinEn: 'Sheikh Mishary Rashid Al-Afasy',
    muezzinAr: 'الشيخ مشاري راشد العفاسي',
    locationEn: 'Kuwait',
    locationAr: 'الكويت',
    audioUrl: `${ISLAMCAN_BASE}/azan8.mp3`,
    format: 'mp3',
    provider: 'islamcan',
  },
  {
    id: 'cairo_fajr',
    nameEn: 'Cairo Fajr Adhan',
    nameAr: 'أذان فجر القاهرة',
    muezzinEn: 'Cairo Fajr recording',
    muezzinAr: 'تسجيل فجر القاهرة',
    locationEn: 'Cairo, Egypt',
    locationAr: 'القاهرة، مصر',
    audioUrl: kiwifu('Adhan_Fajr_Cairo_Egypt_(أذان_الفجر_القاهرة_مصر).mp3'),
    format: 'mp3',
    provider: 'kiwifu_jsdelivr',
  },
  {
    id: 'makkah_fajr',
    nameEn: 'Makkah Fajr (Al-Haram)',
    nameAr: 'أذان فجر الحرم المكي',
    muezzinEn: 'Al-Haram Al-Maki Fajr',
    muezzinAr: 'أذان فجر الحرم المكي',
    locationEn: 'Makkah, Saudi Arabia',
    locationAr: 'مكة المكرمة',
    audioUrl: kiwifu('Adhan_Fajr_Al_Haram_Al_Maki_(أذان_الفجر_الحرم_المكي).mp3'),
    format: 'mp3',
    provider: 'kiwifu_jsdelivr',
  },
  {
    id: 'yasser_dosari',
    nameEn: 'Yasser Al-Dosari Adhan',
    nameAr: 'أذان ياسر الدوسري',
    muezzinEn: 'Sheikh Yasser Al-Dosari',
    muezzinAr: 'الشيخ ياسر الدوسري',
    locationEn: 'Saudi Arabia',
    locationAr: 'المملكة العربية السعودية',
    audioUrl: kiwifu(
      'Yasser_Al-Dosari_-_Saudi_Arabia_(ياسر_الدوسري_-_المملكة_العربية_السعودية).mp3',
    ),
    format: 'mp3',
    provider: 'kiwifu_jsdelivr',
  },
];

/** Short tones for pre-reminder / prayer notification (not full Azan). */
export const NOTIFICATION_SOUND_OPTIONS: NotificationSoundOption[] = [
  {
    id: 'beep_short',
    nameEn: 'Short beep',
    nameAr: 'صفارة قصيرة',
    descriptionEn: 'Simple short alert',
    descriptionAr: 'تنبيه قصير بسيط',
    audioUrl: `${GOOGLE_SOUNDS}/alarms/beep_short.ogg`,
    format: 'ogg',
    provider: 'google_actions',
    isDefault: true,
  },
  {
    id: 'medium_bell',
    nameEn: 'Medium bell',
    nameAr: 'جرس متوسط',
    descriptionEn: 'Clear bell ring',
    descriptionAr: 'رنين جرس واضح',
    audioUrl: `${GOOGLE_SOUNDS}/alarms/medium_bell_ringing_near.ogg`,
    format: 'ogg',
    provider: 'google_actions',
  },
  {
    id: 'dinner_bell',
    nameEn: 'Triangle bell',
    nameAr: 'جرس مثلث',
    descriptionEn: 'Soft triangle tone',
    descriptionAr: 'نغمة مثلث هادئة',
    audioUrl: `${GOOGLE_SOUNDS}/alarms/dinner_bell_triangle.ogg`,
    format: 'ogg',
    provider: 'google_actions',
  },
  {
    id: 'digital_watch',
    nameEn: 'Digital watch',
    nameAr: 'ساعة رقمية',
    descriptionEn: 'Digital watch alarm',
    descriptionAr: 'منبه ساعة رقمية',
    audioUrl: `${GOOGLE_SOUNDS}/alarms/digital_watch_alarm_long.ogg`,
    format: 'ogg',
    provider: 'google_actions',
  },
  {
    id: 'alarm_clock',
    nameEn: 'Alarm clock',
    nameAr: 'منبه',
    descriptionEn: 'Classic alarm clock',
    descriptionAr: 'منبه كلاسيكي',
    audioUrl: `${GOOGLE_SOUNDS}/alarms/alarm_clock.ogg`,
    format: 'ogg',
    provider: 'google_actions',
  },
  {
    id: 'bugle',
    nameEn: 'Bugle tune',
    nameAr: 'نغمة بوق',
    descriptionEn: 'Short bugle melody',
    descriptionAr: 'لحن بوق قصير',
    audioUrl: `${GOOGLE_SOUNDS}/alarms/bugle_tune.ogg`,
    format: 'ogg',
    provider: 'google_actions',
  },
  {
    id: 'phone_ring',
    nameEn: 'Phone ring',
    nameAr: 'رنين هاتف',
    descriptionEn: 'Phone-style alert',
    descriptionAr: 'تنبيه بنمط الهاتف',
    audioUrl: `${GOOGLE_SOUNDS}/alarms/phone_alerts_and_rings.ogg`,
    format: 'ogg',
    provider: 'google_actions',
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
  },
];

export const DEFAULT_AZAN_SOUND_ID = 'makkah';
export const DEFAULT_NOTIFICATION_SOUND_ID = 'beep_short';

/** Legacy aliases stored in older clients / prefs. */
const AZAN_ID_ALIASES: Record<string, string> = {
  makkah: 'makkah',
  azan1: 'makkah',
  madinah: 'madinah',
  madina: 'madinah',
  azan2: 'madinah',
  aqsa: 'aqsa',
  al_aqsa: 'aqsa',
  azan3: 'aqsa',
  egypt: 'egypt',
  egyptian: 'egypt',
  cairo: 'egypt',
  azan4: 'egypt',
  turkey: 'turkey',
  turkish: 'turkey',
  azan5: 'turkey',
  soft: 'soft',
  gentle: 'soft',
  azan6: 'soft',
  abdul_basit: 'abdul_basit',
  abdulbasit: 'abdul_basit',
  azan7: 'abdul_basit',
  mishary: 'mishary',
  alafasy: 'mishary',
  azan8: 'mishary',
  cairo_fajr: 'cairo_fajr',
  makkah_fajr: 'makkah_fajr',
  yasser_dosari: 'yasser_dosari',
  dosari: 'yasser_dosari',
};

export function resolveAzanSoundId(raw?: string | null): string {
  if (!raw?.trim()) return DEFAULT_AZAN_SOUND_ID;
  const key = raw.trim().toLowerCase().replace(/-/g, '_');
  return AZAN_ID_ALIASES[key] ?? (AZAN_SOUND_OPTIONS.some((o) => o.id === key) ? key : DEFAULT_AZAN_SOUND_ID);
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
  return NOTIFICATION_SOUND_OPTIONS.some((o) => o.id === key)
    ? key
    : DEFAULT_NOTIFICATION_SOUND_ID;
}

export function getNotificationSoundById(raw?: string | null): NotificationSoundOption {
  const id = resolveNotificationSoundId(raw);
  return (
    NOTIFICATION_SOUND_OPTIONS.find((o) => o.id === id) ??
    NOTIFICATION_SOUND_OPTIONS.find((o) => o.isDefault) ??
    NOTIFICATION_SOUND_OPTIONS[0]!
  );
}
