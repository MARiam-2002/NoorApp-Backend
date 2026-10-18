import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { profileRouter } from '../src/routes/profile';
import { fajrAlarmRouter } from '../src/routes/fajr-alarm';
import { errorHandler } from '../src/middleware/common';
import { generateAccessToken } from '../src/lib/auth';
import { getSwaggerSpec } from '../src/lib/swagger';
import { FAJR_ALARM_AUDIO_SHA256, resolveFajrAlarmAudioFile } from '../src/services/fajr-alarm-audio.service';
import { prisma } from '../src/lib/prisma';
import { buildFajrAlarmSchedule, fajrAlarmPatchSchema, fajrAlarmPreferencesSchema,
  fajrAlarmScheduleQuerySchema, getFajrAlarmPreferences, updateFajrAlarmPreferences } from '../src/services/fajr-alarm.service';
import { addFajrAlarmOpenApi } from '../src/shared/data/fajr-alarm-openapi';
import { computePrayerInstantsAround } from '../src/services/prayer.service';

async function main() {
  const defaults = fajrAlarmPreferencesSchema.parse({});
  assert.equal(defaults.enabled, false);
  assert.equal(defaults.soundId, 'system_alarm');
  assert.deepEqual(fajrAlarmPatchSchema.parse({ expectedRevision: 0, preferences: { enabled: true } }).preferences, { enabled: true });
  for (const preferences of [{}, { weekdays: [1, 1] }, { weekdays: [] }, { weekdays: [0] },
    { maxRingMinutes: 0 }, { maxRingMinutes: 16 }, { beforeFajrMinutes: 61 },
    { soundId: 'unknown' }, { enabled: 'true' }, { userId: 'someone' }]) {
    assert.equal(fajrAlarmPatchSchema.safeParse({ expectedRevision: 0, preferences }).success, false);
  }
  assert.equal(fajrAlarmPatchSchema.safeParse({ expectedRevision: -1, preferences: { enabled: true } }).success, false);
  assert.equal(fajrAlarmScheduleQuerySchema.safeParse({ days: 15 }).success, false);
  assert.equal(fajrAlarmScheduleQuerySchema.safeParse({ days: ['7', '8'] }).success, false);
  const user = { latitude: 30.0444, longitude: 31.2357, timezone: 'Africa/Cairo', city: 'Cairo', azanPreferences: {}, prayerCalculationMethod: 'AUTO' };
  const state = (preferences = { ...defaults, enabled: true }, revision = 1) => ({ preferences, revision, updatedAt: null, policy: {} as any });
  const now = new Date('2026-10-18T00:00:00Z');
  const regular = buildFajrAlarmSchedule(user, state(), 7, now);
  assert.equal(regular.status, 'READY');
  assert.equal(regular.occurrences.length, 7);
  assert.equal(new Set(regular.occurrences.map(o => o.occurrenceKey)).size, 7);
  const early = buildFajrAlarmSchedule(user, state({ ...defaults, enabled: true, beforeFajrMinutes: 30 }), 7, now);
  regular.occurrences.forEach((o, i) => assert.equal(Date.parse(o.alarmAtUtc) - Date.parse(early.occurrences[i]!.alarmAtUtc), 1800000));
  assert.equal(buildFajrAlarmSchedule(user, state(defaults), 7, now).occurrences.length, 0);
  assert.equal(buildFajrAlarmSchedule({ ...user, latitude: null }, state(), 7, now).status, 'LOCATION_REQUIRED');
  const friday = buildFajrAlarmSchedule(user, state({ ...defaults, enabled: true, weekdays: [5] }), 7, now);
  assert.deepEqual(friday.occurrences.map(o => o.fajrLocalDate), ['2026-10-23']);
  const afterFajr = buildFajrAlarmSchedule(user, state(), 7, new Date('2026-10-18T10:00:00Z'));
  assert.equal(afterFajr.occurrences.length, 6);
  assert.ok(afterFajr.occurrences.every(o => Date.parse(o.alarmAtUtc) > Date.parse('2026-10-18T10:00:00Z')));
  assert.equal(buildFajrAlarmSchedule(user, state(undefined, 2), 7, now).occurrences[0]!.occurrenceKey, regular.occurrences[0]!.occurrenceKey);
  assert.notEqual(buildFajrAlarmSchedule(user, state(undefined, 2), 7, now).scheduleKey, regular.scheduleKey);
  assert.notEqual(buildFajrAlarmSchedule({ ...user, longitude: 32 }, state(), 7, now).scheduleKey, regular.scheduleKey);
  // DST change, fractional offsets, date-line timezone, and stale Cairo timezone when travelling.
  for (const [latitude, longitude, timezone, instant] of [
    [30.0444, 31.2357, 'Africa/Cairo', '2026-10-28T00:00:00Z'],
    [40.7128, -74.006, 'America/New_York', '2026-10-30T00:00:00Z'],
    [27.7172, 85.324, 'Asia/Kathmandu', '2026-10-18T00:00:00Z'],
    [-13.8333, -171.75, 'Pacific/Apia', '2026-10-18T00:00:00Z'],
    [40.7128, -74.006, 'Africa/Cairo', '2026-10-18T00:00:00Z'],
  ] as const) {
    const result = buildFajrAlarmSchedule({ ...user, latitude, longitude, timezone }, state(), 14, new Date(instant));
    assert.ok(result.occurrences.length >= 13);
    assert.ok(result.occurrences.every(o => Number.isFinite(Date.parse(o.alarmAtUtc))));
    for (const o of result.occurrences) {
      const canonical = computePrayerInstantsAround({ latitude, longitude, timezone: result.timezone,
        locationSource: 'profile', method: (result as any).calculationMethod, madhab: (result as any).madhab,
        now: new Date(o.fajrLocalDate + 'T12:00:00Z') }).instants.find(v => v.date === o.fajrLocalDate && v.key === 'FAJR');
      assert.equal(o.fajrAtUtc, canonical?.timestamp.toISOString());
    }
  }
  const polar = buildFajrAlarmSchedule({ ...user, latitude: 89, longitude: 0, timezone: 'Etc/UTC' }, state(), 7, new Date('2026-06-18T00:00:00Z'));
  // The existing prayer engine uses AqrabBalad in polar regions. Preserve that
  // estimate (never quietly substitute a different Fajr algorithm for alarms).
  assert.equal(polar.calculationIsEstimate, true);
  assert.equal(polar.occurrences.length + polar.unavailableDates.length, 7);
  assert.ok(polar.occurrences.every(o => Number.isFinite(Date.parse(o.alarmAtUtc))));
  const spec: any = { paths: {} }; addFajrAlarmOpenApi(spec);
  assert.ok(spec.paths['/fajr-alarm/schedule'].get.security);
  assert.deepEqual(spec.paths['/profile/fajr-alarm-preferences'].patch.requestBody.content['application/json'].schema.properties.preferences.required, []);
  assert.ok(getSwaggerSpec().paths['/fajr-alarm/schedule'], 'Complete lazy Swagger must not fall back to empty paths');
  assert.equal(resolveFajrAlarmAudioFile('../.env'), null);
  const mediaApp = express(); mediaApp.use('/fajr-alarm', fajrAlarmRouter); mediaApp.use(errorHandler);
  const mediaServer = mediaApp.listen(0, '127.0.0.1');
  try {
    await new Promise<void>(resolve => mediaServer.once('listening', resolve));
    const root = `http://127.0.0.1:${(mediaServer.address() as AddressInfo).port}/fajr-alarm`;
    const catalog: any = await (await fetch(root + '/sounds')).json();
    assert.equal(catalog.data.sounds[1].available, true);
    assert.ok(catalog.data.sounds[1].audioUrl.endsWith('/fajr-alarm/media/fajr_wakeup_alarm_v1.mp3'));
    const mediaUrl = root + '/media/fajr_wakeup_alarm_v1.mp3';
    const full = await fetch(mediaUrl); assert.equal(full.status, 200);
    assert.ok(full.headers.get('content-type')?.startsWith('audio/mpeg'));
    const bytes = Buffer.from(await full.arrayBuffer()); assert.equal(bytes.length, 994816);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), FAJR_ALARM_AUDIO_SHA256);
    const range = await fetch(mediaUrl, { headers: { Range: 'bytes=0-15' } });
    assert.equal(range.status, 206); assert.equal((await range.arrayBuffer()).byteLength, 16);
    const suffix = await fetch(mediaUrl, { headers: { Range: 'bytes=-16' } });
    assert.equal(suffix.status, 206); assert.equal((await suffix.arrayBuffer()).byteLength, 16);
    assert.equal((await fetch(root + '/media/not_allowed.mp3')).status, 404);
    assert.equal((await fetch(mediaUrl, { headers: { Range: 'bytes=9999999-' } })).status, 416);
    console.log('Public audio catalog, complete MP3 checksum, byte/suffix ranges, invalid range and filename allowlist passed.');
  } finally { await new Promise<void>((resolve, reject) => mediaServer.close(e => e ? reject(e) : resolve())); }
  console.log('Fajr alarm calendar, canonical prayer parity, DST, travel, polar safety, patch preservation and OpenAPI checks passed.');

  if (process.env.FAJR_ALARM_TEST_DB !== 'true') return;
  const original = { transaction: prisma.$transaction.bind(prisma), query: prisma.$queryRaw };
  const rollback = new Error('FAJR_ALARM_TEST_ROLLBACK');
  const schema = 'fajr_test_' + randomUUID().replace(/-/g, '');
  try {
    await original.transaction(async tx => {
      await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
      await tx.$executeRawUnsafe('CREATE TABLE users (id TEXT PRIMARY KEY)');
      for (const sql of readFileSync('prisma/migrations/20261018140000_fajr_wakeup_alarm/migration.sql', 'utf8').split(';').map(s => s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(sql);
      await tx.$executeRaw`INSERT INTO users(id) VALUES ('owner'), ('other')`;
      (prisma as any).$transaction = async (fn: any) => fn(tx);
      (prisma as any).$queryRaw = tx.$queryRaw.bind(tx);
      assert.equal((await getFajrAlarmPreferences('owner')).revision, 0);
      const first = await updateFajrAlarmPreferences('owner', { expectedRevision: 0, preferences: { enabled: true, beforeFajrMinutes: 20, soundId: 'fajr_wakeup_voice_v1' } });
      assert.equal(first.revision, 1);
      await assert.rejects(updateFajrAlarmPreferences('owner', { expectedRevision: 0, preferences: { enabled: false } }), (e: any) => e.statusCode === 409);
      const second = await updateFajrAlarmPreferences('owner', { expectedRevision: 1, preferences: { questionCount: 3 } });
      assert.equal(second.revision, 2);
      assert.equal(second.preferences.enabled, true);
      assert.equal(second.preferences.beforeFajrMinutes, 20);
      assert.equal(second.preferences.soundId, 'fajr_wakeup_voice_v1');
      assert.equal((await getFajrAlarmPreferences('other')).revision, 0);
      await assert.rejects(updateFajrAlarmPreferences('missing', { expectedRevision: 0, preferences: { enabled: true } }), (e: any) => e.statusCode === 404);
      // Real Express handlers/auth/envelopes against the isolated SQL preferences.
      // User lookups alone are stubbed because Prisma qualifies users with public.
      const originalUserFind = prisma.user.findUnique;
      const originalTxUserFind = tx.user.findUnique;
      const lookup = async (args: any) => ['owner', 'other'].includes(args.where.id)
        ? { ...user, id: args.where.id, isActive: true, email: 'isolated@example.invalid', role: 'USER' } : null;
      (prisma.user as any).findUnique = lookup;
      (tx.user as any).findUnique = lookup;
      const app = express(); app.use(express.json()); app.use('/profile', profileRouter); app.use('/fajr-alarm', fajrAlarmRouter); app.use(errorHandler);
      const server = app.listen(0, '127.0.0.1');
      try {
        await new Promise<void>(resolve => server.once('listening', resolve));
        const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
        const headers = { Authorization: `Bearer ${generateAccessToken({ userId: 'owner', email: 'isolated@example.invalid' })}`, 'Content-Type': 'application/json' };
        assert.equal((await fetch(url + '/profile/fajr-alarm-preferences')).status, 401);
        const prefsResponse = await fetch(url + '/profile/fajr-alarm-preferences', { headers });
        assert.equal(prefsResponse.headers.get('cache-control'), 'private, no-store');
        const prefs: any = await prefsResponse.json(); assert.equal(prefs.success, true); assert.equal(prefs.data.revision, 2);
        const patch = await fetch(url + '/profile/fajr-alarm-preferences', { method: 'PATCH', headers,
          body: JSON.stringify({ expectedRevision: 2, preferences: { maxRingMinutes: 4 } }) });
        assert.equal(patch.status, 200); assert.equal((await patch.json() as any).data.revision, 3);
        const conflict = await fetch(url + '/profile/fajr-alarm-preferences', { method: 'PATCH', headers,
          body: JSON.stringify({ expectedRevision: 2, preferences: { enabled: false } }) });
        assert.equal(conflict.status, 409);
        assert.equal((await fetch(url + '/fajr-alarm/schedule?days=15', { headers })).status, 400);
        const schedule = await fetch(url + '/fajr-alarm/schedule?days=14', { headers });
        assert.equal(schedule.status, 200);
        const payload: any = await schedule.json(); assert.equal(payload.data.revision, 3); assert.equal(payload.data.status, 'READY');
        assert.ok(payload.data.occurrences.length >= 13);
        console.log('HTTP auth, private cache, save envelope, stale 409, invalid query 400 and native schedule 200 passed.');
      } finally {
        await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
        (prisma.user as any).findUnique = originalUserFind;
        (tx.user as any).findUnique = originalTxUserFind;
      }
      await tx.$executeRaw`DELETE FROM users WHERE id = 'owner'`;
      const count = await tx.$queryRaw<{ n: number }[]>`SELECT count(*)::int n FROM fajr_alarm_preferences`;
      assert.equal(count[0]!.n, 0);
      console.log('Isolated PostgreSQL migration, persistence, stale revision, partial edit, account isolation and delete cascade passed; transaction rolled back.');
      throw rollback;
    }, { timeout: 90000 });
  } catch (e) { if (e !== rollback) throw e; }
  finally { (prisma as any).$transaction = original.transaction; (prisma as any).$queryRaw = original.query; await prisma.$disconnect(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
