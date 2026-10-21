/**
 * Offline contract test (no DB, no network, no push):
 *  - GET /devices/notification-channels manifest is self-consistent and every sound it names
 *    is really hosted under assets/ (so Flutter can bundle the exact same files).
 *  - Legacy silent channels are repaired under `_v2` only for devices on channel schema v2.
 *
 * Run: npx tsx scripts/test-notification-contract.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

process.env.DATABASE_URL ||= 'postgresql://offline:offline@127.0.0.1:1/offline';
process.env.JWT_SECRET ||= 'offline-test-secret-offline-test-secret-0001';
process.env.JWT_REFRESH_SECRET ||= 'offline-test-refresh-secret-offline-test-0001';

async function main() {
  const { buildNotificationChannelManifest, CHANNEL_SCHEMA_VERSION } = await import(
    '../src/shared/utils/notification-channel-manifest'
  );
  const { azanChannelId, nearPrayerChannelId } = await import('../src/shared/utils/notification-channels');
  const { AZAN_SOUND_OPTIONS } = await import('../src/shared/constants/azan-sounds');

  const manifest = buildNotificationChannelManifest();
  assert.equal(manifest.channelSchemaVersion, CHANNEL_SCHEMA_VERSION);

  const ids = manifest.channels.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'channel ids must be unique');

  // Every channel the reminder services can target must be in the manifest.
  for (const voice of AZAN_SOUND_OPTIONS) {
    for (const vib of [true, false]) {
      assert.ok(ids.includes(azanChannelId(voice.id, true, vib)), `missing azan channel ${voice.id}`);
    }
  }
  for (const id of [
    azanChannelId('silent', false, true),
    nearPrayerChannelId(null, true),
    nearPrayerChannelId('default', true),
    nearPrayerChannelId('sc_near_fajr', true),
    nearPrayerChannelId('soft_chime', false),
    azanChannelId('sc_event_fajr', true, true),
    'general_v2', 'salawat', 'mulk_v2', 'khatmah_v2', 'duha', 'qiyam', 'noor_charity_v1',
    'adhkar_reminders_default_v1', 'adhkar_reminders_silent_v1', 'kahf_silent_v1', 'continuity_silent_v1',
  ]) {
    assert.ok(ids.includes(id), `manifest missing ${id}`);
  }

  // "default" means sound ON with the OS tone — these channels must never be created silent.
  for (const id of ['general_v2', 'mulk_v2', 'khatmah_v2', 'noor_charity_v1', 'adhkar_reminders_default_v1']) {
    assert.equal(manifest.channels.find((c) => c.id === id)!.nativeSound, 'default', `${id} must play the default tone`);
  }
  for (const c of manifest.channels) {
    if (c.group === 'azan' || c.group === 'prayer_event') assert.equal(c.usage, 'alarm', `${c.id} must use alarm audio`);
    if (c.nativeSound === null) assert.equal(c.iosSoundFile, null);
    if (c.nativeSound && c.nativeSound !== 'default') assert.equal(c.iosSoundFile, `${c.nativeSound}.caf`);
  }

  // Every required sound must exist in assets/ (the source Flutter copies into res/raw + iOS).
  const assetsRoot = path.join(process.cwd(), 'assets');
  const hosted = new Set<string>();
  for (const dir of fs.existsSync(assetsRoot) ? fs.readdirSync(assetsRoot, { withFileTypes: true }) : []) {
    if (!dir.isDirectory()) continue;
    for (const f of fs.readdirSync(path.join(assetsRoot, dir.name))) {
      if (f.endsWith('.mp3')) hosted.add(f.replace(/\.mp3$/, ''));
    }
  }
  if (hosted.size > 0) {
    for (const sound of manifest.requiredBundledSounds) {
      assert.ok(hosted.has(sound), `required sound ${sound} has no assets/**/${sound}.mp3`);
    }
  } else {
    console.log('SKIP asset presence check — assets/ not present in this checkout');
  }
  // Silent legacy channels are repaired under _v2 only for devices that declared schema v2.
  const { resolveDeviceChannelId } = await import('../src/services/device.service');
  assert.equal(resolveDeviceChannelId('mulk', 2), 'mulk_v2');
  assert.equal(resolveDeviceChannelId('mulk', 1), 'mulk');
  assert.equal(resolveDeviceChannelId(undefined, 2), 'general_v2');
  assert.equal(resolveDeviceChannelId(undefined, 1), undefined);
  assert.equal(resolveDeviceChannelId('azan_nasser_al_qatami', 2), 'azan_nasser_al_qatami');
  assert.deepEqual(manifest.legacyChannelIds.sort(), ['general', 'khatmah', 'mulk']);
  for (const legacy of manifest.legacyChannelIds) assert.ok(!ids.includes(legacy), `${legacy} must not be re-created`);

  for (const t of ['AZAN', 'ADHKAR_REMINDER', 'KAHF', 'CONTINUITY', 'CHARITY_REMINDER', 'TEST']) {
    assert.ok(manifest.fcmTypes.includes(t as never), `fcmTypes missing ${t}`);
  }

  console.log(
    `Notification contract passed: ${manifest.channels.length} channels, ` +
      `${manifest.requiredBundledSounds.length} bundled sounds, v2 channel repair routing.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
