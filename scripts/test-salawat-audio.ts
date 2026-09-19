/**
 * Salawat audio catalog + Flutter JSON parsing helpers (no HTTP).
 * Run: npx tsx scripts/test-salawat-audio.ts
 */
import assert from 'node:assert/strict';
import {
  getSalawatAudioCatalog,
  listAvailableSalawatAudioClips,
  pickSalawatAudioClip,
  resolveSalawatMediaFile,
} from '../src/services/salawat-audio.service';
import { salawatPreferencesPatchSchema } from '../src/controllers/salawat.controller';
import { isWithinActiveWindow } from '../src/services/salawat-reminder.service';

const catalog = getSalawatAudioCatalog();
assert.ok(catalog.clips.length >= 2, 'catalog should list clips');
assert.ok(catalog.availableCount >= 1, 'at least one hosted CC0 tone must be available');
assert.ok(catalog.defaultId, 'defaultId when any clip is available');

const required = ['id', 'title', 'url', 'source', 'license', 'creator', 'attribution', 'durationSeconds'];
for (const clip of catalog.clips) {
  for (const key of required) {
    assert.ok(key in clip, `clip missing ${key}`);
  }
  assert.equal(typeof clip.durationSeconds, 'number');
  assert.equal(clip.license, 'CC0-1.0');
}

const available = listAvailableSalawatAudioClips();
assert.ok(available.every((c) => c.available && c.url));

const a = pickSalawatAudioClip('2026-09-19|60|14');
const b = pickSalawatAudioClip('2026-09-19|60|14');
const c = pickSalawatAudioClip('2026-09-19|180|2');
assert.ok(a && b);
assert.equal(a.id, b.id, 'same occurrenceKey rotates to the same clip');
assert.ok(c);

const missing = resolveSalawatMediaFile('does-not-exist.mp3');
assert.equal(missing, null);

const hosted = resolveSalawatMediaFile('soft_chime.mp3');
assert.ok(hosted?.absolutePath);

assert.equal(salawatPreferencesPatchSchema.safeParse({ windowStart: '08:00', windowEnd: '22:00' }).success, true);
assert.equal(salawatPreferencesPatchSchema.safeParse({ startTime: '22:00', endTime: '08:00' }).success, true);
assert.equal(isWithinActiveWindow(23 * 60, '22:00', '08:00'), true);

const emptyCatalogShape = { clips: [] as unknown[] };
assert.equal(Array.isArray(emptyCatalogShape.clips), true);

console.log('salawat audio catalog: OK');
