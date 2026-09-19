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
    title: 'Salli ala Muhammad (voice)',
    titleAr: 'صلِّ على محمد (صوت)',
    creator: 'ibrahim_baig',
    creatorAr: 'ibrahim_baig',
    source: 'https://freesound.org/people/ibrahim_baig/sounds/788917/',
    license: 'CC0-1.0',
    attribution:
      'Sale\'ala\'Muhammad by ibrahim_baig (Freesound), CC0 1.0 — https://freesound.org/people/ibrahim_baig/sounds/788917/',
    durationSeconds: 2,
    playback: 'file',
    listenUrl: 'https://freesound.org/people/ibrahim_baig/sounds/788917/',
    youtubeUrl: null,
    spotifyUrl: null,
    mediaFile: 'salli_ala_muhammad.mp3',
    relativePath: 'salawat/salli_ala_muhammad.mp3',
    format: 'mp3',
    selectable: true,
    isDefault: true,
  },
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

export const DEFAULT_SALAWAT_AUDIO_ID = 'salli_ala_muhammad_voice';

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
    'Voice recording saying "Salli ala Muhammad" plus short notification tones. All CC0 licensed from Freesound.org.',
  sources: [
    'https://freesound.org/people/ibrahim_baig/sounds/788917/',
    'https://freesound.org/people/kevp888/sounds/140128/',
    'https://freesound.org/people/deadrobotmusic/sounds/750607/',
  ],
} as const;
