/**
 * Prayer Upon the Prophet ﷺ audio catalog.
 *
 * - Hosted short tones: CC0 Freesound (playable in-app / notification).
 * - Famous recitations: official listen links stored here for the picker.
 *   Those are NOT mirrored as MP3 (copyright). Flutter opens listenUrl.
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
    id: 'mishary_allahumma_salli',
    title: 'Allahumma salli ala sayyidina Muhammad',
    titleAr: 'اللهم صل على سيدنا محمد',
    creator: 'Mishary Rashid Alafasy',
    creatorAr: 'مشاري راشد العفاسي',
    source: 'https://open.spotify.com/track/2NjazH1wRygYOkRdWgzm7O',
    license: 'all_rights_reserved',
    attribution: 'Mishary Rashid Alafasy — official Spotify. Open listenUrl; do not cache as an app MP3.',
    durationSeconds: 125,
    playback: 'external',
    listenUrl: 'https://open.spotify.com/track/2NjazH1wRygYOkRdWgzm7O',
    youtubeUrl: null,
    spotifyUrl: 'https://open.spotify.com/track/2NjazH1wRygYOkRdWgzm7O',
    mediaFile: null,
    relativePath: null,
    format: 'none',
    selectable: true,
  },
  {
    id: 'maher_ya_nabi_salam',
    title: 'Ya Nabi Salam Alayka',
    titleAr: 'يا نبي سلام عليك',
    creator: 'Maher Zain',
    creatorAr: 'ماهر زين',
    source: 'https://www.youtube.com/watch?v=Vqfy4ScRXFQ',
    license: 'all_rights_reserved',
    attribution: 'Maher Zain / Awakening Music — official YouTube + Spotify. Open listenUrl; do not cache as an app MP3.',
    durationSeconds: 336,
    playback: 'external',
    listenUrl: 'https://www.youtube.com/watch?v=Vqfy4ScRXFQ',
    youtubeUrl: 'https://www.youtube.com/watch?v=Vqfy4ScRXFQ',
    spotifyUrl: 'https://open.spotify.com/track/0KcEMREqmRmjJQoDSNUWnT',
    mediaFile: null,
    relativePath: null,
    format: 'none',
    selectable: true,
  },
  {
    id: 'maher_salla_alayka_rahman',
    title: 'Salla Alayka Rahman',
    titleAr: 'صلى عليك الرحمن',
    creator: 'Maher Zain',
    creatorAr: 'ماهر زين',
    source: 'https://www.youtube.com/watch?v=-Nly_L_f4Ng',
    license: 'all_rights_reserved',
    attribution: 'Maher Zain / Awakening Music — official YouTube + Spotify. Open listenUrl; do not cache as an app MP3.',
    durationSeconds: 245,
    playback: 'external',
    listenUrl: 'https://www.youtube.com/watch?v=-Nly_L_f4Ng',
    youtubeUrl: 'https://www.youtube.com/watch?v=-Nly_L_f4Ng',
    spotifyUrl: 'https://open.spotify.com/track/2JVRBAOAXAcNM21EyziBLj',
    mediaFile: null,
    relativePath: null,
    format: 'none',
    selectable: true,
  },
  {
    id: 'salli_ala_muhammad',
    title: 'Salli ala Muhammad',
    titleAr: 'صلِّ على محمد',
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
    'Picker lists famous recitations as official listen links (YouTube/Spotify) plus short CC0 notification tones. Do not download copyrighted nasheeds into the app. Local reminder audio uses a hosted CC0 file when the selected clip has no MP3.',
  sources: [
    'https://open.spotify.com/track/2NjazH1wRygYOkRdWgzm7O',
    'https://www.youtube.com/watch?v=Vqfy4ScRXFQ',
    'https://www.youtube.com/watch?v=-Nly_L_f4Ng',
    'https://freesound.org/s/140128/',
    'https://freesound.org/s/750607/',
  ],
} as const;
