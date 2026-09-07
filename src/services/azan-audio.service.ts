import {
  AZAN_SOUND_OPTIONS,
  NOTIFICATION_SOUND_OPTIONS,
  DEFAULT_AZAN_SOUND_ID,
  DEFAULT_NOTIFICATION_SOUND_ID,
  AUDIO_SOURCE_POLICY,
  getAzanSoundById,
  getNotificationSoundById,
  type AzanSoundOption,
  type NotificationSoundOption,
} from '../shared/constants/azan-sounds';

export function listAzanSounds(): AzanSoundOption[] {
  return AZAN_SOUND_OPTIONS;
}

export function listNotificationSounds(): NotificationSoundOption[] {
  return NOTIFICATION_SOUND_OPTIONS;
}

export function getAudioDefaults() {
  const azanSound = getAzanSoundById(DEFAULT_AZAN_SOUND_ID);
  const notificationSound = getNotificationSoundById(DEFAULT_NOTIFICATION_SOUND_ID);
  return {
    azanSoundId: azanSound.id,
    notificationSoundId: notificationSound.id,
    voiceId: azanSound.id,
    azanSound,
    notificationSound,
    sourcePolicy: AUDIO_SOURCE_POLICY,
    note: 'Guests use these defaults locally. Logged-in users sync via GET/PATCH /profile/azan-preferences. Show license.attributionText when attributionRequired is true.',
  };
}

export function resolveAudioSelection(input: {
  azanSoundId?: string | null;
  voiceId?: string | null;
  notificationSoundId?: string | null;
}) {
  const azanSound = getAzanSoundById(input.azanSoundId ?? input.voiceId);
  const notificationSound = getNotificationSoundById(input.notificationSoundId);
  return {
    azanSoundId: azanSound.id,
    voiceId: azanSound.id,
    notificationSoundId: notificationSound.id,
    azanSound,
    notificationSound,
  };
}

export type { AzanSoundOption, NotificationSoundOption };
