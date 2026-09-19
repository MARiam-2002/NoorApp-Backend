/**
 * Salawat audio catalog (no HTTP).
 * Run: npx tsx scripts/test-salawat-audio.ts
 */
import assert from 'node:assert/strict';
import {
  getSalawatAudioCatalog,
  getSalawatAudioClipById,
  listAvailableSalawatAudioClips,
  resolveReminderAudioClip,
  resolveSalawatMediaFile,
} from '../src/services/salawat-audio.service';
import { salawatPreferencesPatchSchema } from '../src/controllers/salawat.controller';
import { resolveSalawatAudioClipId } from '../src/shared/constants/salawat-audio';

const catalog = getSalawatAudioCatalog();
assert.ok(catalog.clips.length >= 5, 'catalog should list hosted tones + famous listen links');
assert.ok(catalog.fileCount >= 1, 'at least one hosted CC0 file');
assert.equal(catalog.defaultId, 'peaceful_reminder_tone');

const mishary = catalog.clips.find((c) => c.id === 'mishary_allahumma_salli');
assert.ok(mishary?.listenUrl?.includes('spotify'), 'Mishary listen link stored');
assert.equal(mishary?.playback, 'external');
assert.equal(mishary?.selectable, true);

const maher = catalog.clips.find((c) => c.id === 'maher_ya_nabi_salam');
assert.ok(maher?.youtubeUrl?.includes('youtube.com'), 'Maher YouTube link stored');
assert.ok(maher?.spotifyUrl?.includes('spotify'), 'Maher Spotify link stored');

const required = ['id', 'title', 'source', 'license', 'creator', 'attribution', 'durationSeconds', 'listenUrl'];
for (const clip of catalog.clips) {
  for (const key of required) {
    assert.ok(key in clip, `clip missing ${key}`);
  }
}

const files = listAvailableSalawatAudioClips();
assert.ok(files.every((c) => c.audioUrl));

const famousReminder = resolveReminderAudioClip('mishary_allahumma_salli');
assert.ok(famousReminder?.audioUrl, 'famous selection falls back to hosted MP3 for notifications');
assert.notEqual(famousReminder?.id, 'mishary_allahumma_salli');

assert.equal(resolveSalawatAudioClipId('unknown'), 'peaceful_reminder_tone');
assert.equal(getSalawatAudioClipById('maher_salla_alayka_rahman').id, 'maher_salla_alayka_rahman');

assert.ok(resolveSalawatMediaFile('soft_chime.mp3')?.absolutePath);
assert.equal(resolveSalawatMediaFile('does-not-exist.mp3'), null);

assert.equal(salawatPreferencesPatchSchema.safeParse({ audioClipId: 'mishary_allahumma_salli' }).success, true);
assert.equal(salawatPreferencesPatchSchema.safeParse({ audioClipId: 'not-a-clip' }).success, false);

console.log('salawat audio catalog: OK');
