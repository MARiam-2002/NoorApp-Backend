/**
 * Android notification channel ids shared with Flutter.
 *
 * Android freezes a channel's sound/vibration the first time it is created, so a
 * user-selectable sound needs its own channel. Flutter MUST derive the same id
 * with the same formula, otherwise an FCM backup lands on a channel that does
 * not exist and Android falls back to the generic "Miscellaneous" channel.
 */

const SILENT = 'silent';

function suffix(vibrationEnabled: boolean): string {
  return vibrationEnabled ? '' : '_novib';
}

/** e.g. `azan_nasser_al_qatami`, `azan_silent`, `azan_mishary_alafasy_novib`. */
export function azanChannelId(
  azanSoundId: string,
  soundEnabled: boolean,
  vibrationEnabled: boolean,
): string {
  return `azan_${soundEnabled ? azanSoundId : SILENT}${suffix(vibrationEnabled)}`;
}

/**
 * `nativeSound` is the raw resource basename (`sc_near_fajr`, `soft_chime`),
 * `default` for the OS tone, or null when the reminder is silent.
 * e.g. `near_sc_near_fajr`, `near_default`, `near_silent_novib`.
 */
export function nearPrayerChannelId(
  nativeSound: string | null,
  vibrationEnabled: boolean,
): string {
  return `near_${nativeSound || SILENT}${suffix(vibrationEnabled)}`;
}
