import path from 'node:path';
import fs from 'node:fs';
import type { Request } from 'express';

import { resolvePublicOrigin } from './azan-audio.service';
import {
  DEFAULT_SALAWAT_AUDIO_ID,
  SALAWAT_AUDIO_CLIPS,
  SALAWAT_AUDIO_SOURCE_POLICY,
  resolveSalawatAudioClipId,
  type SalawatAudioClipDef,
  type SalawatPlayback,
} from '../shared/constants/salawat-audio';

export type SalawatAudioClipDto = {
  id: string;
  title: string;
  titleAr: string;
  creator: string;
  creatorAr: string;
  url: string | null;
  audioUrl: string | null;
  previewUrl: string | null;
  listenUrl: string | null;
  youtubeUrl: string | null;
  spotifyUrl: string | null;
  source: string;
  license: string;
  attribution: string;
  durationSeconds: number;
  playback: SalawatPlayback;
  selectable: boolean;
  available: boolean;
  isDefault?: boolean;
};

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

export function salawatMediaAbsoluteUrl(file: string, req?: Request): string {
  return `${resolvePublicOrigin(req)}/api/v1/salawat/media/${file}`;
}

function clipFileExists(clip: SalawatAudioClipDef): boolean {
  if (!clip.relativePath) return false;
  return fs.existsSync(path.join(assetsRoot(), clip.relativePath));
}

function toDto(clip: SalawatAudioClipDef, req?: Request): SalawatAudioClipDto {
  const fileReady = clipFileExists(clip);
  const fileUrl =
    fileReady && clip.mediaFile ? salawatMediaAbsoluteUrl(clip.mediaFile, req) : null;
  return {
    id: clip.id,
    title: clip.title,
    titleAr: clip.titleAr,
    creator: clip.creator,
    creatorAr: clip.creatorAr,
    url: fileUrl,
    audioUrl: fileUrl,
    previewUrl: fileUrl,
    listenUrl: clip.listenUrl,
    youtubeUrl: clip.youtubeUrl,
    spotifyUrl: clip.spotifyUrl,
    source: clip.source,
    license: clip.license,
    attribution: clip.attribution,
    durationSeconds: clip.durationSeconds,
    playback: clip.playback,
    selectable: clip.selectable,
    available: fileReady || Boolean(clip.listenUrl),
    isDefault: clip.isDefault,
  };
}

export function listSalawatAudioClips(req?: Request): SalawatAudioClipDto[] {
  return SALAWAT_AUDIO_CLIPS.map((clip) => toDto(clip, req));
}

export function listAvailableSalawatAudioClips(req?: Request): SalawatAudioClipDto[] {
  return listSalawatAudioClips(req).filter((clip) => clip.audioUrl);
}

export function getSalawatAudioClipById(id: string, req?: Request): SalawatAudioClipDto {
  const resolved = resolveSalawatAudioClipId(id);
  const def = SALAWAT_AUDIO_CLIPS.find((clip) => clip.id === resolved) ?? SALAWAT_AUDIO_CLIPS[0]!;
  return toDto(def, req);
}

export function getSalawatAudioCatalog(req?: Request) {
  const clips = listSalawatAudioClips(req);
  const fileClips = clips.filter((clip) => Boolean(clip.audioUrl));
  return {
    defaultId: DEFAULT_SALAWAT_AUDIO_ID,
    count: clips.length,
    selectableCount: clips.filter((clip) => clip.selectable).length,
    availableCount: clips.filter((clip) => clip.available).length,
    fileCount: fileClips.length,
    clips,
    sourcePolicy: SALAWAT_AUDIO_SOURCE_POLICY,
  };
}

/** Hosted MP3 for local/FCM reminder — never a YouTube/Spotify URL. */
export function resolveReminderAudioClip(
  selectedId: string | null | undefined,
  req?: Request,
): SalawatAudioClipDto | null {
  const selected = getSalawatAudioClipById(selectedId ?? DEFAULT_SALAWAT_AUDIO_ID, req);
  if (selected.audioUrl) return selected;
  return listAvailableSalawatAudioClips(req)[0] ?? null;
}

export function pickSalawatAudioClip(
  occurrenceKey: string,
  req?: Request,
): SalawatAudioClipDto | null {
  const available = listAvailableSalawatAudioClips(req);
  if (available.length === 0) return null;
  let hash = 0;
  for (let i = 0; i < occurrenceKey.length; i += 1) {
    hash = (hash + occurrenceKey.charCodeAt(i) * (i + 1)) % 2_147_483_647;
  }
  return available[hash % available.length] ?? available[0] ?? null;
}

export function resolveSalawatMediaFile(fileParam: string): {
  absolutePath: string;
  contentType: string;
  filename: string;
} | null {
  const key = path.basename(String(fileParam || '').trim());
  const clip = SALAWAT_AUDIO_CLIPS.find((item) => item.mediaFile === key);
  if (!clip?.relativePath) return null;
  const absolutePath = path.join(assetsRoot(), clip.relativePath);
  if (!fs.existsSync(absolutePath)) return null;
  return { absolutePath, contentType: 'audio/mpeg', filename: key };
}
