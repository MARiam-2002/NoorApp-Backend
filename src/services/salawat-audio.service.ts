import path from 'node:path';
import fs from 'node:fs';
import type { Request } from 'express';

import { resolvePublicOrigin } from './azan-audio.service';
import {
  DEFAULT_SALAWAT_AUDIO_ID,
  SALAWAT_AUDIO_CLIPS,
  SALAWAT_AUDIO_SOURCE_POLICY,
  type SalawatAudioClipDef,
} from '../shared/constants/salawat-audio';

export type SalawatAudioClipDto = {
  id: string;
  title: string;
  titleAr: string;
  url: string | null;
  audioUrl: string | null;
  previewUrl: string | null;
  source: string;
  license: string;
  creator: string;
  attribution: string;
  durationSeconds: number;
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
  const available = clipFileExists(clip);
  const url =
    available && clip.mediaFile ? salawatMediaAbsoluteUrl(clip.mediaFile, req) : null;
  return {
    id: clip.id,
    title: clip.title,
    titleAr: clip.titleAr,
    url,
    audioUrl: url,
    previewUrl: url,
    source: clip.source,
    license: clip.license,
    creator: clip.creator,
    attribution: clip.attribution,
    durationSeconds: clip.durationSeconds,
    available,
    isDefault: clip.isDefault,
  };
}

export function listSalawatAudioClips(req?: Request): SalawatAudioClipDto[] {
  return SALAWAT_AUDIO_CLIPS.map((clip) => toDto(clip, req));
}

export function listAvailableSalawatAudioClips(req?: Request): SalawatAudioClipDto[] {
  return listSalawatAudioClips(req).filter((clip) => clip.available);
}

export function getSalawatAudioCatalog(req?: Request) {
  const clips = listSalawatAudioClips(req);
  const available = clips.filter((clip) => clip.available);
  const defaultClip =
    available.find((clip) => clip.id === DEFAULT_SALAWAT_AUDIO_ID) ?? available[0] ?? null;
  return {
    defaultId: defaultClip?.id ?? null,
    count: clips.length,
    availableCount: available.length,
    clips,
    sourcePolicy: SALAWAT_AUDIO_SOURCE_POLICY,
  };
}

/**
 * Rotate among playable clips using the durable occurrence key so the same
 * slot always maps to the same file (cron-safe).
 */
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
