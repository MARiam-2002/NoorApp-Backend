import path from 'node:path';
import { existsSync } from 'node:fs';
import type { Request } from 'express';
import { resolvePublicOrigin } from './azan-audio.service';

export const FAJR_ALARM_AUDIO_FILE = 'fajr_wakeup_alarm_v1.mp3';
export const FAJR_ALARM_AUDIO_SHA256 = '77f64784a80c4f189bae24521f6e4433ac0f3f96fd5e31888277ce33fac5971f';
export function resolveFajrAlarmAudioFile(filename: string): string | null {
  // Fixed allowlist: never turn an arbitrary URL parameter into a filesystem path.
  if (filename !== FAJR_ALARM_AUDIO_FILE) return null;
  for (const root of [process.cwd(), path.resolve(__dirname, '../..'), path.resolve(__dirname, '../../..')]) {
    const candidate = path.join(root, 'assets', 'fajr-alarm', FAJR_ALARM_AUDIO_FILE);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}
export function getFajrAlarmSounds(req?: Request) {
  const available = !!resolveFajrAlarmAudioFile(FAJR_ALARM_AUDIO_FILE);
  const url = available ? `${resolvePublicOrigin(req)}/api/v1/fajr-alarm/media/${FAJR_ALARM_AUDIO_FILE}` : null;
  return { defaultId: 'system_alarm', downloadBeforeArming: true, sounds: [
    { id: 'system_alarm', titleAr: 'صوت منبّه الجهاز', audioUrl: null, previewUrl: null, sha256: null, available: true, playback: 'SYSTEM' },
    { id: 'fajr_wakeup_voice_v1', titleAr: 'الصلاة خير من النوم', audioUrl: url, previewUrl: url,
      sha256: FAJR_ALARM_AUDIO_SHA256, sizeBytes: 994816, available, playback: 'LOCAL_FILE',
      sourceUrl: 'https://www.youtube.com/watch?v=onvTvACwHCE', licenseStatus: 'NOT_VERIFIED' },
  ] };
}
