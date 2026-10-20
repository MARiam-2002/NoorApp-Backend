import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { azanRouter } from '../src/routes/azan';
import { listNotificationSounds, listPrayerVoiceSounds } from '../src/services/azan-audio.service';

async function main() {
  const catalog = listPrayerVoiceSounds();
  assert.equal(catalog.requiresNativeBundling, true);
  assert.equal(catalog.nearPrayer.autoSelectionId, 'sc_near_auto');
  assert.equal(catalog.nearPrayer.sounds.length, 7);
  assert.equal(catalog.prayerTime.preferenceValue, 'announcement');
  assert.equal(catalog.prayerTime.sounds.length, 6);
  for (const sound of [...catalog.nearPrayer.sounds, ...catalog.prayerTime.sounds]) {
    assert.equal(sound.available, true);
    if (sound.id === 'sc_near_auto') {
      assert.equal(sound.nativeSound, null);
      assert.equal(sound.previewUrl, null);
    } else {
      assert.equal(sound.nativeSound, sound.id);
      assert.ok(sound.previewUrl?.endsWith(`/azan/media/${sound.id}.mp3`));
    }
  }
  assert.ok(listNotificationSounds().every(s => !s.id.startsWith('sc_near_') && !s.id.startsWith('sc_event_')));
  assert.ok(!catalog.prayerTime.sounds.some(s => /duha|qiyam/.test(s.id)));
  const app = express();
  app.use('/api/v1/azan', azanRouter);
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>(r => server.once('listening', r));
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/azan/prayer-voice-sounds`);
    assert.equal(response.status, 200, 'Discovery must work for guests without a token');
    const body = await response.json() as any;
    assert.equal(body.success, true);
    assert.equal(body.data.prayerTime.sounds.length, 6);
    assert.ok(body.data.nearPrayer.sounds[1].previewUrl.startsWith('http://127.0.0.1:'));
  } finally {
    await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
  }
  console.log('Prayer spoken-voice catalog passed: 6 approaching clips + auto selector, 6 at-time clips, disk availability, tone separation and public HTTP contract. No database/push calls.');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
