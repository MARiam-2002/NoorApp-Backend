import path from 'node:path';
import fs from 'node:fs';
import type { Request } from 'express';

import {
  AZAN_MEDIA_FILES,
  AZAN_SOUND_OPTIONS,
  NOTIFICATION_SOUND_OPTIONS,
  DEFAULT_AZAN_SOUND_ID,
  DEFAULT_NOTIFICATION_SOUND_ID,
  AUDIO_SOURCE_POLICY,
  FAMOUS_AZAN_VOICE_AUDIT,
  getAzanSoundById,
  getNotificationSoundById,
  type AzanSoundOption,
  type NotificationSoundOption,
} from '../shared/constants/azan-sounds';

const PRODUCTION_PUBLIC_ORIGIN = 'https://noor-app-backend-one.vercel.app';

function assetsRoot(): string {
  const candidates = [
    path.join(process.cwd(), 'assets'),
    path.join(__dirname, '..', '..', 'assets'),
    path.join(__dirname, '..', '..', '..', 'assets'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return candidates[0]!;
}

export function resolvePublicOrigin(req?: Request): string {
  if (req) {
    const proto = (req.get('x-forwarded-proto') || req.protocol || 'https')
      .split(',')[0]
      ?.trim();
    const host = (req.get('x-forwarded-host') || req.get('host') || '')
      .split(',')[0]
      ?.trim();
    if (proto && host) return `${proto}://${host}`;
  }
  return process.env.PUBLIC_APP_ORIGIN?.trim() || PRODUCTION_PUBLIC_ORIGIN;
}

export function mediaAbsoluteUrl(file: string, req?: Request): string {
  return `${resolvePublicOrigin(req)}/api/v1/azan/media/${file}`;
}

function withAbsoluteUrls<T extends AzanSoundOption | NotificationSoundOption>(
  option: T,
  req?: Request,
): T {
  if (!('mediaFile' in option) || option.mediaFile == null) {
    return { ...option, audioUrl: null, previewUrl: null } as T;
  }
  const url = mediaAbsoluteUrl(option.mediaFile, req);
  return {
    ...option,
    audioUrl: url,
    previewUrl: url,
  };
}

export function listAzanSounds(req?: Request): AzanSoundOption[] {
  return AZAN_SOUND_OPTIONS.map((o) => withAbsoluteUrls(o, req));
}

export function listNotificationSounds(req?: Request): NotificationSoundOption[] {
  return NOTIFICATION_SOUND_OPTIONS.map((o) => withAbsoluteUrls(o, req));
}

export function getAudioDefaults(req?: Request) {
  const azanSound = withAbsoluteUrls(getAzanSoundById(DEFAULT_AZAN_SOUND_ID), req);
  const notificationSound = withAbsoluteUrls(
    getNotificationSoundById(DEFAULT_NOTIFICATION_SOUND_ID),
    req,
  );
  return {
    azanSoundId: azanSound.id,
    notificationSoundId: notificationSound.id,
    voiceId: azanSound.id,
    azanSound,
    notificationSound,
    sourcePolicy: AUDIO_SOURCE_POLICY,
    famousVoicesAudit: FAMOUS_AZAN_VOICE_AUDIT,
    note: 'Guests use these defaults locally. Logged-in users sync via GET/PATCH /profile/azan-preferences. Show license.attributionText when attributionRequired is true. Famous Haramain/Egyptian voices are listed in famousVoicesAudit as blocked until written rights exist. Preview uses the same URL as audioUrl (self-hosted /azan/media).',
  };
}

export function resolveAudioSelection(
  input: {
    azanSoundId?: string | null;
    voiceId?: string | null;
    notificationSoundId?: string | null;
  },
  req?: Request,
) {
  const azanSound = withAbsoluteUrls(
    getAzanSoundById(input.azanSoundId ?? input.voiceId),
    req,
  );
  const notificationSound = withAbsoluteUrls(
    getNotificationSoundById(input.notificationSoundId),
    req,
  );
  return {
    azanSoundId: azanSound.id,
    voiceId: azanSound.id,
    notificationSoundId: notificationSound.id,
    azanSound,
    notificationSound,
  };
}

export function resolveMediaFile(fileParam: string): {
  absolutePath: string;
  contentType: string;
  filename: string;
} | null {
  const key = path.basename(String(fileParam || '').trim());
  const meta = AZAN_MEDIA_FILES[key];
  if (!meta) return null;
  const absolutePath = path.join(assetsRoot(), meta.relativePath);
  if (!fs.existsSync(absolutePath)) return null;
  return { absolutePath, contentType: meta.contentType, filename: key };
}

export type { AzanSoundOption, NotificationSoundOption };
