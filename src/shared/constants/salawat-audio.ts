/**
 * Prayer Upon the Prophet ﷺ audio catalog — NOTIFICATION TONES ONLY.
 *
 * Short reminder sounds for FCM push notifications.
 * All clips are CC0 licensed and hosted in assets/notification/.
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
    id: 'peaceful_reminder_tone',
    title: 'Peaceful reminder tone',
    titleAr: 'نغمة تذكير هادئة',
    creator: 'kevp888',
    creatorAr: 'kevp888',
    source: 'https://freesound.org/people/kevp888/sounds/140128/',
    license: 'CC0-1.0',
    attribution:
      'Tibetan Singing Bowl by kevp888 (Freesound), CC0 1.0 — https://freesound.org/s/140128/',
    durationSeconds: 4,
    playback: 'file',
    listenUrl: null,
    youtubeUrl: null,
    spotifyUrl: null,
    mediaFile: 'meditation_bell.mp3',
    relativePath: 'notification/meditation_bell.mp3',
    format: 'mp3',
    selectable: true,
    isDefault: true,
  },
  {
    id: 'calm_chime',
    title: 'Calm chime',
    titleAr: 'رنين هادئ',
    creator: 'deadrobotmusic',
    creatorAr: 'deadrobotmusic',
    source: 'https://freesound.org/people/deadrobotmusic/sounds/750607/',
    license: 'CC0-1.0',
    attribution:
      'Notification Sound 1 by deadrobotmusic (Freesound), CC0 1.0 — https://freesound.org/s/750607/',
    durationSeconds: 2,
    playback: 'file',
    listenUrl: null,
    youtubeUrl: null,
    spotifyUrl: null,
    mediaFile: 'soft_chime.mp3',
    relativePath: 'notification/soft_chime.mp3',
    format: 'mp3',
    selectable: true,
  },
];

export const DEFAULT_SALAWAT_AUDIO_ID = 'peaceful_reminder_tone';

export function isKnownSalawatAudioId(id: string): boolean {
  return SALAWAT_AUDIO_CLIPS.some((clip) => clip.id === id);
}

export function resolveSalawatAudioClipId(raw?: string | null): string {
  const id = raw?.trim() || '';
  if (isKnownSalawatAudioId(id)) return id;
  return DEFAULT_SALAWAT_AUDIO_ID;
}

export const SALAWAT_AUDIO_SOURCE_POLICY = {
  note:
    'Short CC0 notification tones for prayer-upon-the-prophet reminders. All files are self-hosted and playable in-app.',
  sources: [
    'https://freesound.org/people/kevp888/sounds/140128/',
    'https://freesound.org/people/deadrobotmusic/sounds/750607/',
  ],
} as const;
