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
    assert.ok(body.data.nearPrayer.sounds[1].previewUrl.endsWith('/azan/media/sc_near_fajr.mp3'));
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const shortResponse = await fetch(origin + '/api/v1/azan/takbir-sounds');
    assert.equal(shortResponse.status, 200);
    const shorts = (await shortResponse.json() as any).data;
    assert.equal(shorts.count, 14);
    assert.equal(shorts.minimumChannelSchemaVersion, 3);
    const nasser = shorts.sounds.find((s: any) => s.id === 'takbir_nasser_al_qatami_v1');
    assert.ok(nasser.durationSeconds < 15, 'must serve approved short Nasser, not the older 27-second candidate');
    for (const [file, type] of [[nasser.mediaFile, 'audio/mpeg'], [nasser.iosSoundFile, 'audio/x-caf']]) {
      const media = await fetch(origin + '/api/v1/azan/media/' + file, { headers: { Range: 'bytes=0-127' } });
      assert.equal(media.status, 206);
      assert.equal(media.headers.get('content-type'), type);
      assert.equal((await media.arrayBuffer()).byteLength, 128);
    }
    const spoof = await fetch(origin + '/api/v1/azan/prayer-voice-sounds', { headers: { 'X-Forwarded-Host': 'attacker.invalid' } });
    assert.ok(!JSON.stringify(await spoof.json()).includes('attacker.invalid'));
    const suffix = await fetch(origin + '/api/v1/azan/media/sc_near_asr.mp3', { headers: { Range: 'bytes=-128' } });
    assert.equal(suffix.status, 206);
    assert.equal((await suffix.arrayBuffer()).byteLength, 128);
    assert.ok(suffix.headers.get('content-range')?.startsWith('bytes 58957-59084/59085'));
    const invalid = await fetch(origin + '/api/v1/azan/media/sc_near_asr.mp3', { headers: { Range: 'bytes=-0' } });
    assert.equal(invalid.status, 416);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
  }
  console.log('Prayer spoken-voice catalog passed: 6 approaching clips + auto selector, 6 at-time clips, disk availability, tone separation and public HTTP contract. No database/push calls.');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
