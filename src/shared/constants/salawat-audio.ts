/**
 * Prayer Upon the Prophet ﷺ audio catalog.
 *
 * Voice recordings saying "Salli ala Muhammad" for reminders.
 * All clips are CC0 licensed from Freesound.org.
 */

export type SalawatPlayback = 'file' | 'external';

export type SalawatAudioClipDef = {
  id: string;
  title: string;
  titleAr: string;
  creator: string;
  creatorAr: string;
  source: string;
  license: string;
  attribution: string;
  durationSeconds: number;
  playback: SalawatPlayback;
  listenUrl: string | null;
  youtubeUrl: string | null;
  spotifyUrl: string | null;
  mediaFile: string | null;
  relativePath: string | null;
  format: 'mp3' | 'none';
  selectable: boolean;
  isDefault?: boolean;
};

export const SALAWAT_AUDIO_CLIPS: SalawatAudioClipDef[] = [
  {
    id: 'salli_ala_muhammad_voice',
    title: 'Salli ala Muhammad',
    titleAr: 'صلِّ على محمد',
    creator: 'Noor Audio',
    creatorAr: 'نور',
    source: 'Custom recording for Noor app',
    license: 'Custom',
    attribution: 'صلِّ على محمد ﷺ - Noor App',
    durationSeconds: 3,
    playback: 'file',
    listenUrl: null,
    youtubeUrl: null,
    spotifyUrl: null,
    mediaFile: 'salli_ala_muhammad.mp3',
    relativePath: 'salawat/salli_ala_muhammad.mp3',
    format: 'mp3',
    selectable: true,
    isDefault: true,
  },
];

export const DEFAULT_SALAWAT_AUDIO_ID = 'salli_ala_muhammad_voice';

export function isKnownSalawatAudioId(id: string): boolean {
  return SALAWAT_AUDIO_CLIPS.some((clip) => clip.id === id);
}

export function resolveSalawatAudioClipId(raw?: string | null): string {
  const id = raw?.trim() || '';
  if (isKnownSalawatAudioId(id)) return id;
  // Legacy defaults / removed ids → canonical single Salawat voice.
  if (
    id === 'peaceful_reminder_tone' ||
    id === 'salli_ala_muhammad' ||
    id === 'salawat' ||
    id === 'SALAWAT_SOUND'
  ) {
    return DEFAULT_SALAWAT_AUDIO_ID;
  }
  return DEFAULT_SALAWAT_AUDIO_ID;
}

export const SALAWAT_AUDIO_SOURCE_POLICY = {
  note: 'صلِّ على محمد ﷺ - Voice recording for Salawat reminder',
  sources: ['Custom recording for Noor app'],
} as const;
