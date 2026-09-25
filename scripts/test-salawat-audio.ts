/**
 * Salawat audio catalog (no HTTP).
 * Run: npx tsx scripts/test-salawat-audio.ts
 *
 * Canonical catalog: one shared voice — salli_ala_muhammad_voice
 * (assets/salawat/salli_ala_muhammad.mp3).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  getSalawatAudioCatalog,
  getSalawatAudioClipById,
  listAvailableSalawatAudioClips,
  resolveReminderAudioClip,
  resolveSalawatMediaFile,
} from '../src/services/salawat-audio.service';
import { salawatPreferencesPatchSchema } from '../src/controllers/salawat.controller';
import {
  DEFAULT_SALAWAT_AUDIO_ID,
  resolveSalawatAudioClipId,
} from '../src/shared/constants/salawat-audio';

const catalog = getSalawatAudioCatalog();
assert.equal(catalog.defaultId, DEFAULT_SALAWAT_AUDIO_ID);
assert.equal(catalog.defaultId, 'salli_ala_muhammad_voice');
assert.ok(catalog.clips.length >= 1);
assert.ok(catalog.fileCount >= 1);

const voice = catalog.clips.find((c) => c.id === 'salli_ala_muhammad_voice');
assert.ok(voice);
assert.equal(voice?.mediaFile, 'salli_ala_muhammad.mp3');
assert.equal(voice?.playback, 'file');
assert.equal(voice?.selectable, true);

const required = [
  'id',
  'title',
  'titleAr',
  'source',
  'license',
  'creator',
  'attribution',
  'durationSeconds',
];
for (const clip of catalog.clips) {
  for (const key of required) {
    assert.ok(key in clip, `clip missing ${key}`);
  }
}

const files = listAvailableSalawatAudioClips();
assert.ok(files.every((c) => c.audioUrl));

const reminder = resolveReminderAudioClip('salli_ala_muhammad_voice');
assert.ok(reminder?.audioUrl);
assert.equal(reminder?.id, 'salli_ala_muhammad_voice');

assert.equal(resolveSalawatAudioClipId('unknown'), 'salli_ala_muhammad_voice');
assert.equal(resolveSalawatAudioClipId('peaceful_reminder_tone'), 'salli_ala_muhammad_voice');
assert.equal(getSalawatAudioClipById('salli_ala_muhammad_voice').id, 'salli_ala_muhammad_voice');

assert.ok(resolveSalawatMediaFile('salli_ala_muhammad.mp3')?.absolutePath);
assert.equal(resolveSalawatMediaFile('does-not-exist.mp3'), null);

const onDisk = path.join(process.cwd(), 'assets', 'salawat', 'salli_ala_muhammad.mp3');
assert.ok(fs.existsSync(onDisk), 'assets/salawat/salli_ala_muhammad.mp3 must exist');

assert.equal(
  salawatPreferencesPatchSchema.safeParse({ audioClipId: 'salli_ala_muhammad_voice' }).success,
  true,
);
assert.equal(
  salawatPreferencesPatchSchema.safeParse({ audioClipId: 'peaceful_reminder_tone' }).success,
  true,
);
assert.equal(salawatPreferencesPatchSchema.safeParse({ audioClipId: 'not-a-clip' }).success, false);

console.log('salawat audio catalog: OK');
