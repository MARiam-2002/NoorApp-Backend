import assert from 'node:assert/strict';
import { buildFcmMulticastMessage, isDefinitivelyInvalidFcmToken } from '../src/lib/fcm';

const now = Date.parse('2026-10-20T10:00:00Z');
for (const raw of ['sc_near_asr', 'sc_event_asr', 'nasser_al_qatami', 'default']) {
  const channel = `test_${raw}`;
  const message = buildFcmMulticastMessage(['fake-token'], {
    title: 'Audio contract test', body: 'No delivery', nativeSound: raw,
    androidChannelId: channel, ttlSeconds: 60,
    data: { nativeSound: 'stale_sound', androidChannelId: 'stale_channel', occurrenceKey: 'date|ASR|prayer_time' },
  }, now);
  assert.equal(message.data.nativeSound, raw, 'Foreground receives the actual native sound');
  assert.equal(message.android.notification.sound, raw);
  assert.equal(message.data.androidChannelId, channel);
  assert.equal(message.android.notification.channelId, channel);
  assert.equal(message.apns.payload.aps.sound, raw === 'default' ? raw : `${raw}.caf`);
  assert.equal(message.android.ttl, 60_000);
  assert.equal(message.apns.headers['apns-expiration'], String(now / 1000 + 60));
  assert.equal(message.android.notification.tag, message.data.occurrenceKey);
  assert.ok(Object.values(message.data).every(v => typeof v === 'string'));
}
const silent = buildFcmMulticastMessage(['fake-token'], {
  title: 'Silent', body: 'No delivery', nativeSound: null, androidChannelId: 'near_silent',
  data: { soundEnabled: 'true', nativeSound: 'sc_near_asr' },
}, now);
assert.equal(silent.data.nativeSound, '');
assert.equal(silent.data.soundEnabled, 'false');
assert.ok(!('sound' in silent.android.notification));
assert.ok(!('sound' in silent.apns.payload.aps));
const defaultSound = buildFcmMulticastMessage([], { title: 'Default', body: 'No delivery' }, now);
assert.equal(defaultSound.data.nativeSound, 'default');
assert.equal(defaultSound.data.androidChannelId, 'general');
for (const code of ['messaging/invalid-argument', 'messaging/invalid-data-payload-key', 'messaging/server-unavailable', 'messaging/mismatched-credential']) {
  assert.equal(isDefinitivelyInvalidFcmToken(code), false, `Must retain token on ${code}`);
}
assert.equal(isDefinitivelyInvalidFcmToken('messaging/registration-token-not-registered'), true);
assert.equal(isDefinitivelyInvalidFcmToken('messaging/invalid-registration-token'), true);
console.log('FCM audio transport contract passed: foreground/background parity, silent/default/custom audio, expiry, channel identity and safe token pruning. No network/push calls.');
