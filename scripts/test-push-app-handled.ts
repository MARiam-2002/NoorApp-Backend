import assert from 'node:assert/strict';
import { buildFcmMulticastMessage } from '../src/lib/fcm';
import { isAppHandledAndroidDevice } from '../src/services/device.service';
import { PUSH_TTL_SECONDS } from '../src/shared/utils/reminder-timing';

// Android installs that schedule prayer alarms locally own the delivery.
assert.equal(isAppHandledAndroidDevice('android', { exactAlarmsAllowed: true }), true);
assert.equal(isAppHandledAndroidDevice('android', { exactAlarmsAllowed: false }), false, 'no local alarms → OS notification');
assert.equal(isAppHandledAndroidDevice('android', null), false, 'old app without capabilities');
assert.equal(isAppHandledAndroidDevice('ios', { exactAlarmsAllowed: true }), false, 'iOS stays an APNs alert');

const now = Date.UTC(2026, 10, 26, 12, 0, 0);
const appHandled: any = buildFcmMulticastMessage(['t'], {
  title: 'حان الآن موعد صلاة الظهر',
  body: 'الظهر 12:00',
  data: { type: 'AZAN', occurrenceKey: 'AZAN:2026-11-26:DHUHR:time', announcementNativeSound: 'sc_event_dhuhr' },
  nativeSound: 'nasser_al_qatami',
  androidChannelId: 'azan_nasser_al_qatami',
  ttlSeconds: 600,
  androidDataOnly: true,
}, now);
assert.equal(appHandled.notification, undefined, 'no OS-displayed notification: the app decides');
assert.equal(appHandled.android.notification, undefined);
assert.equal(appHandled.android.priority, 'high');
assert.equal(appHandled.android.ttl, 600_000, 'an offline phone drops it after 10 minutes');
assert.equal(appHandled.data.title, 'حان الآن موعد صلاة الظهر');
assert.equal(appHandled.data.body, 'الظهر 12:00');
assert.equal(appHandled.data.deliveryMode, 'APP_HANDLED');
assert.equal(appHandled.data.announcementNativeSound, 'sc_event_dhuhr', 'announcement reaches the app');
assert.equal(appHandled.data.nativeSound, 'nasser_al_qatami');
for (const v of Object.values(appHandled.data)) assert.equal(typeof v, 'string', 'FCM data values are strings');

const osShown: any = buildFcmMulticastMessage(['t'], {
  title: 'x', body: 'y', data: { type: 'AZAN' }, ttlSeconds: 600,
}, now);
assert.ok(osShown.notification, 'default stays a notification message');
assert.equal(osShown.android.ttl, 600_000);

assert.ok(PUSH_TTL_SECONDS.AZAN <= 10 * 60, 'Azan never arrives more than 10 minutes late');
assert.ok(PUSH_TTL_SECONDS.SCHEDULED_REMINDER <= 20 * 60);
assert.ok(PUSH_TTL_SECONDS.SALAWAT <= 15 * 60);

console.log('push app-handled: ok');
