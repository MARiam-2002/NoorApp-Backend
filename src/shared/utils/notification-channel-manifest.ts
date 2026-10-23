import { TAKBIR_SOUND_OPTIONS } from '../constants/takbir-sounds';
/**
 * Single source of truth for every Android notification channel the backend may target
 * and every iOS sound file it may name (GET /devices/notification-channels).
 *
 * Why: Android locks a channel's sound the first time the channel is created. When the
 * server pushes to a channel id the device never created (or created silently), the OS
 * either drops to the generic fallback channel or plays nothing. Flutter must create
 * EXACTLY these channels, with EXACTLY these sounds, before the first push arrives.
 *
 * Bump CHANNEL_SCHEMA_VERSION whenever a channel's sound/importance/usage changes; Flutter
 * reports the version it synced in POST /devices/fcm-token → capabilities.
 */
import {
  AZAN_SOUND_OPTIONS,
  NEAR_PRAYER_SOUND_OPTIONS,
  NOTIFICATION_SOUND_OPTIONS,
  PRAYER_EVENT_SOUND_OPTIONS,
} from '../constants/azan-sounds';
import { DEFAULT_SALAWAT_NATIVE_SOUND } from '../constants/salawat-audio';
import { azanChannelId, nearPrayerChannelId } from './notification-channels';

export const CHANNEL_SCHEMA_VERSION = 3;

/**
 * Channels that older app builds created WITHOUT sound (playSound=false). Android restores a
 * deleted channel's old settings when the same id is re-created, so schema v2 repairs them
 * under `<id>_v2`. The backend targets `<id>_v2` only for devices that declared
 * capabilities.channelSchemaVersion >= 2 (see device.service resolveDeviceChannelId).
 */
export const REPAIRED_CHANNEL_IDS: ReadonlySet<string> = new Set(['general', 'mulk', 'khatmah']);

export type ChannelUsage = 'alarm' | 'notification';
export type ChannelImportance = 'max' | 'high' | 'default' | 'low';

export type NotificationChannelSpec = {
  id: string;
  group: 'azan' | 'near_prayer' | 'prayer_event' | 'reminder' | 'general' | 'silent';
  nameEn: string;
  nameAr: string;
  /**
   * Android raw resource basename / iOS `<name>.caf`.
   * `default` = the OS default notification tone (must still play sound!).
   * `null` = channel is intentionally silent.
   */
  nativeSound: string | null;
  iosSoundFile: string | null;
  importance: ChannelImportance;
  usage: ChannelUsage;
  vibration: boolean;
};

/** Every FCM `data.type` the backend sends. Flutter must handle all of them (foreground too). */
export const FCM_NOTIFICATION_TYPES = [
  'AZAN',
  'SALAWAT',
  'MULK',
  'DUHA',
  'QIYAM',
  'KHATMAH',
  'KAHF',
  'CONTINUITY',
  'CHARITY_REMINDER',
  'ADHKAR_REMINDER',
  'TEST',
] as const;

function iosFile(sound: string | null): string | null {
  if (!sound) return null;
  return sound === 'default' ? 'default' : `${sound}.caf`;
}

function spec(
  input: Omit<NotificationChannelSpec, 'iosSoundFile'>,
): NotificationChannelSpec {
  return { ...input, iosSoundFile: iosFile(input.nativeSound) };
}

function nearSoundBasenames(): string[] {
  const near = NEAR_PRAYER_SOUND_OPTIONS.map((o) => o.mediaFile).filter(
    (f): f is string => Boolean(f),
  );
  const tones = NOTIFICATION_SOUND_OPTIONS.map((o) => o.mediaFile).filter(
    (f): f is string => Boolean(f),
  );
  return [...new Set([...near, ...tones].map((f) => f.replace(/\.mp3$/i, '')))];
}

export function buildNotificationChannelManifest(): {
  channelSchemaVersion: number;
  fcmTypes: readonly string[];
  /** Old silent channels to delete on upgrade (never re-create them). */
  legacyChannelIds: string[];
  /** Value for AndroidManifest `com.google.firebase.messaging.default_notification_channel_id`. */
  defaultFcmChannelId: string;
  channels: NotificationChannelSpec[];
  requiredBundledSounds: string[];
} {
  const channels: NotificationChannelSpec[] = [];

  for (const vibration of [true, false]) {
    // Prayer time: one channel per Azan voice (full Adhan on Android, 30 s clip on iOS).
    for (const voice of AZAN_SOUND_OPTIONS) {
      channels.push(
        spec({
          id: azanChannelId(voice.id, true, vibration),
          group: 'azan',
          nameEn: `Azan — ${voice.nameEn}`,
          nameAr: `الأذان — ${voice.nameAr}`,
          nativeSound: voice.id,
          importance: 'max',
          usage: 'alarm',
          vibration,
        }),
      );
    }
    for (const clip of TAKBIR_SOUND_OPTIONS) {
      channels.push(spec({ id: azanChannelId(clip.id, true, vibration), group: 'azan',
        nameEn: clip.nameEn, nameAr: clip.nameAr, nativeSound: clip.id,
        importance: 'max', usage: 'alarm', vibration }));
    }
    // Prayer time "announcement" mode (short clip per prayer).
    for (const clip of PRAYER_EVENT_SOUND_OPTIONS) {
      if (clip.id === 'sc_event_duha' || clip.id === 'sc_event_qiyam') continue;
      channels.push(
        spec({
          id: azanChannelId(clip.id, true, vibration),
          group: 'prayer_event',
          nameEn: `Prayer announcement — ${clip.nameEn}`,
          nameAr: `تنبيه الصلاة — ${clip.nameAr}`,
          nativeSound: clip.id,
          importance: 'max',
          usage: 'alarm',
          vibration,
        }),
      );
    }
    channels.push(
      spec({
        id: azanChannelId('silent', false, vibration),
        group: 'silent',
        nameEn: 'Azan (silent)',
        nameAr: 'الأذان (صامت)',
        nativeSound: null,
        importance: 'max',
        usage: 'alarm',
        vibration,
      }),
    );

    // Pre-prayer reminder: one channel per near clip / tone + default + silent.
    for (const sound of nearSoundBasenames()) {
      channels.push(
        spec({
          id: nearPrayerChannelId(sound, vibration),
          group: 'near_prayer',
          nameEn: `Pre-prayer reminder — ${sound}`,
          nameAr: `تذكير قبل الصلاة — ${sound}`,
          nativeSound: sound,
          importance: 'high',
          usage: 'notification',
          vibration,
        }),
      );
    }
    channels.push(
      spec({
        id: nearPrayerChannelId('default', vibration),
        group: 'near_prayer',
        nameEn: 'Pre-prayer reminder — default tone',
        nameAr: 'تذكير قبل الصلاة — النغمة الافتراضية',
        nativeSound: 'default',
        importance: 'high',
        usage: 'notification',
        vibration,
      }),
      spec({
        id: nearPrayerChannelId(null, vibration),
        group: 'silent',
        nameEn: 'Pre-prayer reminder (silent)',
        nameAr: 'تذكير قبل الصلاة (صامت)',
        nativeSound: null,
        importance: 'high',
        usage: 'notification',
        vibration,
      }),
    );
  }

  channels.push(
    spec({ id: 'general_v2', group: 'general', nameEn: 'General', nameAr: 'عام', nativeSound: 'default', importance: 'high', usage: 'notification', vibration: true }),
    spec({ id: 'salawat', group: 'reminder', nameEn: 'Salawat', nameAr: 'الصلاة على النبي ﷺ', nativeSound: DEFAULT_SALAWAT_NATIVE_SOUND, importance: 'default', usage: 'notification', vibration: true }),
    spec({ id: 'mulk_v2', group: 'reminder', nameEn: 'Surat Al-Mulk', nameAr: 'سورة الملك', nativeSound: 'default', importance: 'high', usage: 'notification', vibration: true }),
    spec({ id: 'khatmah_v2', group: 'reminder', nameEn: 'Khatmah', nameAr: 'ورد الختمة', nativeSound: 'default', importance: 'high', usage: 'notification', vibration: true }),
    spec({ id: 'duha', group: 'reminder', nameEn: 'Duha prayer', nameAr: 'صلاة الضحى', nativeSound: 'sc_event_duha', importance: 'high', usage: 'notification', vibration: true }),
    spec({ id: 'qiyam', group: 'reminder', nameEn: 'Qiyam prayer', nameAr: 'قيام الليل', nativeSound: 'sc_event_qiyam', importance: 'high', usage: 'notification', vibration: true }),
    spec({ id: 'noor_charity_v1', group: 'reminder', nameEn: 'Charity reminder', nameAr: 'تذكير الصدقة', nativeSound: 'default', importance: 'default', usage: 'notification', vibration: true }),
    spec({ id: 'adhkar_reminders_default_v1', group: 'reminder', nameEn: 'Adhkar reminders', nameAr: 'تذكير الأذكار', nativeSound: 'default', importance: 'high', usage: 'notification', vibration: false }),
    spec({ id: 'adhkar_reminders_silent_v1', group: 'silent', nameEn: 'Adhkar reminders (silent)', nameAr: 'تذكير الأذكار (صامت)', nativeSound: null, importance: 'default', usage: 'notification', vibration: false }),
    spec({ id: 'kahf_silent_v1', group: 'silent', nameEn: 'Surat Al-Kahf', nameAr: 'سورة الكهف', nativeSound: null, importance: 'default', usage: 'notification', vibration: false }),
    spec({ id: 'continuity_silent_v1', group: 'silent', nameEn: 'Continuity', nameAr: 'الاستمرارية', nativeSound: null, importance: 'default', usage: 'notification', vibration: false }),
  );

  const requiredBundledSounds = [
    ...new Set(
      channels
        .map((c) => c.nativeSound)
        .filter((s): s is string => Boolean(s) && s !== 'default'),
    ),
  ].sort();

  return {
    channelSchemaVersion: CHANNEL_SCHEMA_VERSION,
    fcmTypes: FCM_NOTIFICATION_TYPES,
    legacyChannelIds: [...REPAIRED_CHANNEL_IDS],
    defaultFcmChannelId: 'general_v2',
    channels,
    requiredBundledSounds,
  };
}
