/**
 * Prayer Upon the Prophet ﷺ reminder audio catalog.
 *
 * Vocal clips are CC0 Freesound recordings by ibrahim_baig (explicit public-domain grant).
 * Peaceful reminder tones reuse already-hosted CC0 Freesound files from /assets/notification.
 * Do not add YouTube / TikTok / Spotify / commercial nasheed URLs.
 */

export type SalawatAudioLicense = {
  spdxOrName: 'CC0-1.0';
  licenseUrl: string;
  attributionRequired: boolean;
  attributionText: string;
  commercialUseAllowed: boolean;
  sourcePageUrl: string;
};

export type SalawatAudioClipDef = {
  id: string;
  title: string;
  titleAr: string;
  source: string;
  license: string;
  creator: string;
  attribution: string;
  durationSeconds: number;
  mediaFile: string | null;
  /** Path under assets/ when self-hosted. */
  relativePath: string | null;
  format: 'mp3' | 'none';
  isDefault?: boolean;
  licenseMeta: SalawatAudioLicense;
};

const CC0: Pick<SalawatAudioLicense, 'spdxOrName' | 'licenseUrl' | 'attributionRequired' | 'commercialUseAllowed'> = {
  spdxOrName: 'CC0-1.0',
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  attributionRequired: false,
  commercialUseAllowed: true,
};

export const SALAWAT_AUDIO_CLIPS: SalawatAudioClipDef[] = [
  {
    id: 'salli_ala_muhammad',
    title: 'Salli ala Muhammad',
    titleAr: 'صلِّ على محمد',
    source: 'https://freesound.org/people/ibrahim_baig/sounds/788917/',
    license: 'CC0-1.0',
    creator: 'ibrahim_baig',
    attribution:
      'Sale\'ala\'Muhammad by ibrahim_baig (Freesound), CC0 1.0 — https://freesound.org/people/ibrahim_baig/sounds/788917/',
    durationSeconds: 2,
    mediaFile: 'salli_ala_muhammad.mp3',
    relativePath: 'salawat/salli_ala_muhammad.mp3',
    format: 'mp3',
    licenseMeta: {
      ...CC0,
      attributionText:
        'Sale\'ala\'Muhammad by ibrahim_baig (Freesound), CC0 1.0 — https://freesound.org/people/ibrahim_baig/sounds/788917/',
      sourcePageUrl: 'https://freesound.org/people/ibrahim_baig/sounds/788917/',
    },
  },
  {
    id: 'laa_tansi_salli_ala_muhammad',
    title: 'La tansa dhikr Allah — Salli ala Muhammad',
    titleAr: 'لا تنس ذكر الله — صلِّ على محمد',
    source: 'https://freesound.org/people/ibrahim_baig/sounds/788912/',
    license: 'CC0-1.0',
    creator: 'ibrahim_baig',
    attribution:
      'Laa Tansi ZikrAllah with Salli ala Muhammad by ibrahim_baig (Freesound), CC0 1.0 — https://freesound.org/people/ibrahim_baig/sounds/788912/',
    durationSeconds: 5,
    mediaFile: 'laa_tansi_salli_ala_muhammad.mp3',
    relativePath: 'salawat/laa_tansi_salli_ala_muhammad.mp3',
    format: 'mp3',
    licenseMeta: {
      ...CC0,
      attributionText:
        'Laa Tansi ZikrAllah with Salli ala Muhammad by ibrahim_baig (Freesound), CC0 1.0 — https://freesound.org/people/ibrahim_baig/sounds/788912/',
      sourcePageUrl: 'https://freesound.org/people/ibrahim_baig/sounds/788912/',
    },
  },
  {
    id: 'peaceful_reminder_tone',
    title: 'Peaceful reminder tone',
    titleAr: 'نغمة تذكير هادئة',
    source: 'https://freesound.org/people/kevp888/sounds/140128/',
    license: 'CC0-1.0',
    creator: 'kevp888',
    attribution:
      'Tibetan Singing Bowl, Medium, A4, Single, Bright, Close, 01 by kevp888 (Freesound), CC0 1.0 — https://freesound.org/s/140128/',
    durationSeconds: 4,
    mediaFile: 'meditation_bell.mp3',
    relativePath: 'notification/meditation_bell.mp3',
    format: 'mp3',
    isDefault: true,
    licenseMeta: {
      ...CC0,
      attributionText:
        'Tibetan Singing Bowl, Medium, A4, Single, Bright, Close, 01 by kevp888 (Freesound), CC0 1.0 — https://freesound.org/s/140128/',
      sourcePageUrl: 'https://freesound.org/people/kevp888/sounds/140128/',
    },
  },
  {
    id: 'calm_chime',
    title: 'Calm chime',
    titleAr: 'رنين هادئ',
    source: 'https://freesound.org/people/deadrobotmusic/sounds/750607/',
    license: 'CC0-1.0',
    creator: 'deadrobotmusic',
    attribution:
      'Notification Sound 1 by deadrobotmusic (Freesound), CC0 1.0 — https://freesound.org/s/750607/',
    durationSeconds: 2,
    mediaFile: 'soft_chime.mp3',
    relativePath: 'notification/soft_chime.mp3',
    format: 'mp3',
    licenseMeta: {
      ...CC0,
      attributionText:
        'Notification Sound 1 by deadrobotmusic (Freesound), CC0 1.0 — https://freesound.org/s/750607/',
      sourcePageUrl: 'https://freesound.org/people/deadrobotmusic/sounds/750607/',
    },
  },
];

export const DEFAULT_SALAWAT_AUDIO_ID = 'peaceful_reminder_tone';

export const SALAWAT_AUDIO_SOURCE_POLICY = {
  note:
    'Only CC0 / explicitly permissioned clips. Vocal Salawat files are included when present under assets/salawat. Peaceful tones reuse hosted CC0 notification audio. Rotation uses available clips only.',
  sources: [
    'https://freesound.org/people/ibrahim_baig/sounds/788917/',
    'https://freesound.org/people/ibrahim_baig/sounds/788912/',
    'https://freesound.org/s/140128/',
    'https://freesound.org/s/750607/',
  ],
} as const;
