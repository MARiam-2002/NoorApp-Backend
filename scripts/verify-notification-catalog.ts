import fs from 'fs';
import path from 'path';
import {
  NOTIFICATION_SOUND_OPTIONS,
  NEAR_PRAYER_SOUND_OPTIONS,
  PRAYER_EVENT_SOUND_OPTIONS,
  getNotificationSoundById,
  AZAN_MEDIA_FILES,
} from '../src/shared/constants/azan-sounds';
import { listNotificationSounds } from '../src/services/azan-audio.service';

const dir = path.join('assets', 'notification');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.mp3')).sort();
const catalogFiles = NOTIFICATION_SOUND_OPTIONS.map((o) => o.mediaFile).filter(Boolean).sort() as string[];
const sounds = listNotificationSounds();

console.log(
  JSON.stringify(
    {
      folderCount: files.length,
      catalogMp3Count: catalogFiles.length,
      listCount: sounds.length,
      missingInCatalog: files.filter((f) => !catalogFiles.includes(f)),
      extraInCatalog: catalogFiles.filter((f) => !files.includes(f)),
      hasNearOrEventInList: sounds.some((s) => String(s.id).startsWith('sc_')),
      ids: sounds.map((s) => s.id),
      resolveNear: getNotificationSoundById('sc_near_fajr').id,
      resolveNotifyBeep: getNotificationSoundById('notify_beep').id,
      nearCount: NEAR_PRAYER_SOUND_OPTIONS.length,
      eventCount: PRAYER_EVENT_SOUND_OPTIONS.length,
      mediaMapMissing: files.filter((f) => !AZAN_MEDIA_FILES[f]),
    },
    null,
    2,
  ),
);
