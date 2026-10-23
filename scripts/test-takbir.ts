import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TAKBIR_SOUND_OPTIONS, DEFAULT_TAKBIR_SOUND_ID } from '../src/shared/constants/takbir-sounds';
import { azanPreferencesSchema, defaultAzanPreferences, pickExplicitAzanPatch, effectivePrayerTimeSoundMode, buildAzanPreferencesFromUser } from '../src/services/azan.service';
import { listTakbirSounds, resolveMediaFile } from '../src/services/azan-audio.service';
import { buildNotificationChannelManifest } from '../src/shared/utils/notification-channel-manifest';
import { resolveTakbirDeviceAudio } from '../src/services/device.service';
import { buildFcmMulticastMessage } from '../src/lib/fcm';
import { prayerScheduleKey } from '../src/services/travel.service';
import { prisma } from '../src/lib/prisma';
import { updateAzanPreferences } from '../src/services/azan.service';

const defaults = defaultAzanPreferences();
assert.equal(defaults.prayerTimeSoundMode, 'azan');
assert.equal(defaults.takbirSoundId, DEFAULT_TAKBIR_SOUND_ID);
assert.deepEqual(defaults.prayerTimeSoundOverrides, {});
assert.deepEqual(pickExplicitAzanPatch({ soundEnabled: false }), { soundEnabled: false });
assert.deepEqual(pickExplicitAzanPatch({ prayerTimeSoundOverrides: {} }), { prayerTimeSoundOverrides: {} });
for (const bad of ['unknown', '../takbir', 'nasser_al_qatami']) assert.equal(azanPreferencesSchema.safeParse({ takbirSoundId: bad }).success, false);
assert.equal(azanPreferencesSchema.safeParse({ prayerTimeSoundOverrides: { midnight: 'takbir' } }).success, false);
assert.equal(azanPreferencesSchema.safeParse({ prayerTimeSoundMode: 'unknown' }).success, false);
const prefs = azanPreferencesSchema.parse({ prayerTimeSoundMode: 'azan', prayerTimeSoundOverrides: { fajr: 'takbir', dhuhr: 'announcement' } });
assert.equal(effectivePrayerTimeSoundMode(prefs, 'FAJR'), 'takbir');
assert.equal(effectivePrayerTimeSoundMode(prefs, 'DHUHR'), 'announcement');
assert.equal(effectivePrayerTimeSoundMode(prefs, 'MAGHRIB'), 'azan');
const user = { latitude: 30, longitude: 31, timezone: 'Africa/Cairo', city: 'Cairo', prayerCalculationMethod: 'EGYPT', azanPreferences: {} };
assert.notEqual(prayerScheduleKey(user), prayerScheduleKey({ ...user, azanPreferences: prefs }));
assert.equal(buildAzanPreferencesFromUser(user).prayerTimeSoundMode, 'azan');
assert.equal(TAKBIR_SOUND_OPTIONS.length, 14);
const manifest = buildNotificationChannelManifest();
assert.equal(manifest.channelSchemaVersion, 3);
const catalog = listTakbirSounds();
assert.equal(catalog.count, 14);
for (const clip of catalog.sounds) {
  assert.ok(clip.available && clip.durationSeconds > 0 && clip.durationSeconds < 30);
  assert.ok(resolveMediaFile(clip.mediaFile));
  assert.ok(fs.statSync(`assets/takbir-ios/${clip.iosSoundFile}`).size > 1000);
  assert.ok(manifest.requiredBundledSounds.includes(clip.nativeSound));
  for (const suffix of ['', '_novib']) {
    const channel = manifest.channels.find(c => c.id === `azan_${clip.id}${suffix}`)!;
    assert.equal(channel.nativeSound, clip.id);
    assert.equal(channel.iosSoundFile, clip.iosSoundFile);
  }
}
const original = { title: 'Prayer', body: 'Time', nativeSound: DEFAULT_TAKBIR_SOUND_ID, androidChannelId: `azan_${DEFAULT_TAKBIR_SOUND_ID}`, data: { audioScope: 'prayer_time_takbir', soundId: DEFAULT_TAKBIR_SOUND_ID, vibrationEnabled: 'false' } };
const ready = resolveTakbirDeviceAudio({ channelSchemaVersion: 3, bundledSounds: [DEFAULT_TAKBIR_SOUND_ID] }, original);
assert.equal(ready.nativeSound, DEFAULT_TAKBIR_SOUND_ID);
const audibleWire = buildFcmMulticastMessage(['test'], { ...original, ...ready });
assert.equal(audibleWire.apns.payload.aps.sound, `${DEFAULT_TAKBIR_SOUND_ID}.caf`);
for (const caps of [null, {}, { channelSchemaVersion: 2, bundledSounds: [DEFAULT_TAKBIR_SOUND_ID] }, { channelSchemaVersion: 3, bundledSounds: [] }]) {
  const fallback = resolveTakbirDeviceAudio(caps, original);
  assert.equal(fallback.nativeSound, null);
  assert.equal(fallback.androidChannelId, 'azan_silent_novib');
  const wire = buildFcmMulticastMessage(['test'], { ...original, ...fallback });
  assert.equal(wire.data.soundEnabled, 'false');
  assert.ok(!('sound' in wire.apns.payload.aps));
  assert.ok(!('sound' in wire.android.notification));
}
assert.equal(resolveTakbirDeviceAudio(null, { ...original, data: { audioScope: 'prayer_time_azan' } }).nativeSound, DEFAULT_TAKBIR_SOUND_ID, 'unrelated audio path unchanged');
assert.equal(resolveTakbirDeviceAudio(null, { ...original, nativeSound: null }).nativeSound, null, 'mute preserved');
async function persistenceChecks() {
  const originalTransaction = prisma.$transaction;
  let stored: any = { ...user, azanPreferences: { voiceId: 'mohamed_rifaat', azanSoundId: 'mohamed_rifaat', notificationSoundId: 'soft_chime', localScheduledUntil: '2026-10-24T10:00:00Z' } };
  prisma.$transaction = (async (callback: any) => callback({
    $queryRaw: async () => [stored],
    user: { update: async (args: any) => { stored = { ...stored, ...args.data }; return stored; } },
  })) as any;
  try {
    const first = await updateAzanPreferences('fixture', pickExplicitAzanPatch({ prayerTimeSoundMode: 'takbir', prayerTimeSoundOverrides: { fajr: 'azan' } }));
    assert.equal(first.prayerTimeSoundMode, 'takbir');
    assert.equal(first.azanSoundId, 'mohamed_rifaat');
    assert.equal(first.notificationSoundId, 'soft_chime');
    assert.equal(first.localScheduledUntil, null);
    const second = await updateAzanPreferences('fixture', pickExplicitAzanPatch({ vibrationEnabled: false }));
    assert.equal(second.prayerTimeSoundMode, 'takbir');
    assert.deepEqual(second.prayerTimeSoundOverrides, { fajr: 'azan' });
    const cleared = await updateAzanPreferences('fixture', pickExplicitAzanPatch({ prayerTimeSoundOverrides: {} }));
    assert.deepEqual(cleared.prayerTimeSoundOverrides, {});
    assert.equal(cleared.takbirSoundId, DEFAULT_TAKBIR_SOUND_ID);
  } finally { prisma.$transaction = originalTransaction; }
}
persistenceChecks().then(() => console.log('Takbir catalog, validation, inheritance, partial persistence, schedule invalidation and device audio contracts passed; DB mocked, no network or production writes.'))
  .catch(error => { console.error(error); process.exitCode = 1; });
