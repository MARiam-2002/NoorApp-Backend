/**
 * Sunnah fasting & occasions: every evidence text verbatim against the pinned hadith editions (and al-Albani's grade
 * for al-Tirmidhi), calendar rules on known Umm al-Qura dates, occasions, reminder decisions (incl. no double reminder
 * with the make-up fast), routes, and — with HIFZ_TEST_DB=true — preferences on PostgreSQL (rolled back).
 *
 *   node scripts/fetch-hadith-editions.cjs && npx tsx scripts/test-sunnah-fasting.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { findSahihPhrase, tirmidhiGrades } from './lib/sahihayn-lookup';
import { FASTING_EVIDENCE, OCCASIONS, SUNNAH_FASTS, FORBIDDEN_FASTS } from '../src/shared/data/sunnah-fasting';
import {
  sunnahDay, getSunnahCalendar, getOccasions, getSunnahToday, evaluateSunnahReminder, getSunnahPreferences, updateSunnahPreferences,
} from '../src/services/sunnah-fasting.service';
import { qadaReminderContext } from '../src/services/fasting-qada.service';
import { sunnahFastingRouter } from '../src/routes/sunnah-fasting';
import { prisma } from '../src/lib/prisma';

// ---- evidence: verbatim, right number, acceptable grade
const NAME = { bukhari: 'البخاري', muslim: 'مسلم', tirmidhi: 'الترمذي' } as const;
for (const e of Object.values(FASTING_EVIDENCE)) {
  const hits = findSahihPhrase(e.collection, e.textAr);
  assert.ok(hits.some(h => h.number === e.number), `${e.id}: text not found verbatim in ${e.collection} ${e.number}`);
  assert.ok(e.referenceAr.startsWith(`رواه ${NAME[e.collection]} (${e.number})`), `${e.id}: reference`);
  if (e.collection === 'tirmidhi') {
    const albani = tirmidhiGrades(e.number)['Al-Albani'];
    assert.ok(['Sahih', 'Hasan', 'Hasan Sahih'].includes(albani!), `${e.id}: al-Albani grade ${albani}`);
    assert.match(e.referenceAr, /الألباني/);
  }
}
const used = new Set([...Object.values(SUNNAH_FASTS), ...Object.values(FORBIDDEN_FASTS), ...OCCASIONS].flatMap(x => x.evidence));
for (const id of used) assert.ok(FASTING_EVIDENCE[id], `missing evidence ${id}`);
for (const id of Object.keys(FASTING_EVIDENCE)) assert.ok(used.has(id), `unused evidence ${id}`);

// ---- calendar on known Umm al-Qura dates (1447/1448)
const types = (d: string, o = 0) => sunnahDay(d, o).fasts.map(f => f.type);
assert.equal(sunnahDay('2026-03-20').forbidden?.type, 'EID_AL_FITR');
assert.equal(sunnahDay('2026-03-19').ramadan, true);
assert.deepEqual(types('2026-03-19'), [], 'no sunnah fasts in Ramadan');
assert.deepEqual(types('2026-05-26'), ['ARAFAH']);
assert.equal(sunnahDay('2026-05-27').forbidden?.type, 'EID_AL_ADHA');
assert.equal(sunnahDay('2026-05-30').forbidden?.type, 'TASHREEQ', '13 Dhul-Hijjah is a day of tashreeq');
assert.deepEqual(types('2026-05-30'), [], 'white day 13 Dhul-Hijjah is not offered');
assert.deepEqual(types('2026-05-31'), ['WHITE_DAYS']);
assert.deepEqual(types('2026-06-24'), ['TASUA']);
assert.deepEqual(types('2026-06-25'), ['THURSDAY', 'ASHURA']);
assert.deepEqual(types('2026-11-16'), ['MONDAY']);
assert.deepEqual(types('2026-03-21'), ['SIX_SHAWWAL'], '2 Shawwal (Saturday)');
assert.equal(sunnahDay('2026-11-13').hijri.monthNameAr, 'جمادى الآخرة');
// The moon-sighting correction moves Arafah by one day.
assert.deepEqual(types('2026-05-26', -1), [], 'with -1 the 9th falls on the next day');
assert.deepEqual(types('2026-05-27', -1), ['ARAFAH']);

const cal = getSunnahCalendar('2026-06-16', 31);
assert.equal(cal.items.length, 31);
assert.equal(cal.items.filter(d => d.fasts.some(f => f.type === 'WHITE_DAYS')).length, 3);
assert.equal(cal.fastTypes.length, 7);
assert.ok(cal.fastTypes.every(t => t.evidence.length > 0));
assert.throws(() => getSunnahCalendar('2026-06-16', 63), (e: any) => e.statusCode === 400);
assert.throws(() => getSunnahCalendar('16-06-2026', 5), (e: any) => e.statusCode === 400);

const occ = getOccasions(1448);
assert.deepEqual(occ.occasions.map(o => o.id), OCCASIONS.map(o => o.id));
const byId = Object.fromEntries(occ.occasions.map(o => [o.id, o]));
assert.equal(byId.ASHURA!.startDate, '2026-06-24');
assert.equal(byId.TASHREEQ!.days, 3);
assert.ok([29, 30].includes(byId.RAMADAN!.days));
assert.equal(byId.ARAFAH!.startDate, byId.DHUL_HIJJAH_TEN!.endDate);
assert.equal(byId.EID_AL_ADHA!.startDate > byId.ARAFAH!.startDate, true);
assert.throws(() => getOccasions(1300), (e: any) => e.statusCode === 400);

const ashuraDay = getSunnahToday('2026-06-25');
assert.deepEqual(ashuraDay.activeOccasions.map(o => o.id).sort(), ['ASHURA', 'MUHARRAM']);
assert.ok(ashuraDay.nextFast && ashuraDay.nextFast.daysLeft <= 4);
const friday = getSunnahToday('2026-11-13');
assert.equal(friday.nextFast!.date, '2026-11-16');
assert.equal(friday.nextOccasion!.id, 'SHABAN');

// ---- reminders (Cairo, 21:00 local = 19:00Z in November)
const prefs = { enabled: true, types: ['MONDAY', 'THURSDAY', 'WHITE_DAYS', 'ARAFAH', 'TASUA', 'ASHURA', 'SIX_SHAWWAL'], occasionsEnabled: true,
  reminderTime: '21:00', hijriOffsetDays: 0, timezone: 'Africa/Cairo', revision: 0, androidChannelId: 'sunnah_fasting_v1' };
const at = (iso: string) => new Date(iso);
const sun = evaluateSunnahReminder(at('2026-11-15T19:00:00Z'), 'Africa/Cairo', prefs, false);
assert.equal(sun!.kind, 'FAST'); assert.deepEqual((sun as any).fastTypes, ['MONDAY']); assert.equal(sun!.occurrenceKey, 'SUNNAH|2026-11-16');
assert.equal(evaluateSunnahReminder(at('2026-11-15T19:00:00Z'), 'Africa/Cairo', prefs, true), null, 'the make-up reminder already covers tomorrow');
assert.equal(evaluateSunnahReminder(at('2026-11-15T15:00:00Z'), 'Africa/Cairo', prefs, false), null, 'not due yet');
assert.equal(evaluateSunnahReminder(at('2026-11-15T19:00:00Z'), 'Africa/Cairo', { ...prefs, types: ['THURSDAY'] }, false), null, 'type switched off');
assert.equal(evaluateSunnahReminder(at('2026-11-15T19:00:00Z'), 'Africa/Cairo', { ...prefs, enabled: false }, false), null);
// Eve of Ashura (Thursday 25 June 2026; Cairo is UTC+3 in summer): one message naming both, Ashura first.
const ashuraEve = evaluateSunnahReminder(at('2026-06-24T18:00:00Z'), 'Africa/Cairo', prefs, false)!;
assert.deepEqual((ashuraEve as any).fastTypes, ['THURSDAY', 'ASHURA']);
assert.match(ashuraEve.titleAr, /^غدًا صيام عاشوراء/);
// Eve of 1 Dhul-Hijjah 1448 (2027-05-07): no fast tomorrow → occasion reminder.
const dh = evaluateSunnahReminder(at('2027-05-06T18:00:00Z'), 'Africa/Cairo', { ...prefs, types: [] }, false)!;
assert.equal(dh.kind, 'OCCASION'); assert.equal((dh as any).occasionId, 'DHUL_HIJJAH_TEN');
assert.equal(evaluateSunnahReminder(at('2027-05-06T18:00:00Z'), 'Africa/Cairo', { ...prefs, types: [], occasionsEnabled: false }, false), null);
// Six of Shawwal: only on the eve of 2 Shawwal (1447: Saturday 21 March 2026), not every night of the month.
assert.deepEqual((evaluateSunnahReminder(at('2026-03-20T19:00:00Z'), 'Africa/Cairo', prefs, false) as any).fastTypes, ['SIX_SHAWWAL']);
assert.equal(evaluateSunnahReminder(at('2026-03-23T19:00:00Z'), 'Africa/Cairo', { ...prefs, types: ['SIX_SHAWWAL'] }, false), null);
// Eve of Eid / Ramadan: nothing.
assert.equal(evaluateSunnahReminder(at('2026-03-19T19:00:00Z'), 'Africa/Cairo', prefs, false), null);
assert.equal(evaluateSunnahReminder(at('2026-02-20T19:00:00Z'), 'Africa/Cairo', prefs, false), null, 'inside Ramadan');

async function routes() {
  const app = express(); app.use(express.json()); app.use('/fasting', sunnahFastingRouter);
  app.use(((error: any, _req: any, res: any, _next: any) => { res.status(error.statusCode ?? (error.name === 'ZodError' ? 400 : 500)).json({ success: false }); }) as express.ErrorRequestHandler);
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/fasting`;
    for (const p of ['/sunnah/today?date=2026-06-25', '/sunnah/today?timezone=Africa/Cairo&hijriOffset=-1', '/sunnah/calendar?from=2026-06-16&days=31', '/occasions?hijriYear=1448', '/occasions']) {
      const r = await fetch(base + p); assert.equal(r.status, 200, p); assert.equal(r.headers.get('cache-control'), 'public, max-age=900');
    }
    for (const p of ['/sunnah/today?hijriOffset=5', '/sunnah/calendar?days=100', '/sunnah/today?date=bad', '/occasions?hijriYear=99']) assert.equal((await fetch(base + p)).status, 400, p);
    assert.equal((await fetch(base + '/sunnah/preferences')).status, 401);
    assert.equal((await fetch(base + '/sunnah/preferences', { method: 'PATCH' })).status, 401);
  } finally { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
}

async function db() {
  if (process.env.HIFZ_TEST_DB !== 'true') { console.log('SKIP sunnah DB flow: set HIFZ_TEST_DB=true'); return; }
  const rollback = new Error('ROLLBACK');
  try {
    await prisma.$transaction(async (tx: any) => {
      const exists = await tx.$queryRawUnsafe(`SELECT to_regclass('public.sunnah_fasting_preferences')::text AS t`);
      if (!exists[0].t) await tx.$executeRawUnsafe(readFileSync('prisma/migrations/20261113100000_station_and_sunnah_fasting/migration.sql', 'utf8'));
      await tx.$executeRawUnsafe(`INSERT INTO users(id, username, email, timezone, "updatedAt") VALUES ('sf-user','sf-user','sf@test.local','Africa/Cairo', now())`);
      const d = await getSunnahPreferences('sf-user', tx);
      assert.equal(d.enabled, false); assert.equal(d.types.length, 7); assert.equal(d.hijriOffsetDays, 0); assert.equal(d.reminderTime, '21:00');
      const u = await updateSunnahPreferences('sf-user', { enabled: true, types: ['ARAFAH', 'ASHURA', 'ARAFAH'], reminderTime: '20:30', hijriOffsetDays: -1 }, tx);
      assert.deepEqual([u.enabled, u.types, u.reminderTime, u.hijriOffsetDays, u.revision], [true, ['ARAFAH', 'ASHURA'], '20:30', -1, 0]);
      const u2 = await updateSunnahPreferences('sf-user', { occasionsEnabled: false }, tx);
      assert.deepEqual([u2.enabled, u2.types, u2.occasionsEnabled, u2.revision], [true, ['ARAFAH', 'ASHURA'], false, 1], 'partial update keeps the rest');
      const shared: any[] = await tx.$queryRawUnsafe(`SELECT "hijriOffsetDays","remindersEnabled" FROM "fasting_qada_preferences" WHERE "userId"='sf-user'`);
      assert.deepEqual([Number(shared[0].hijriOffsetDays), shared[0].remindersEnabled], [-1, false], 'correction is shared with qada; qada reminders untouched');
      await assert.rejects(updateSunnahPreferences('sf-user', { hijriOffsetDays: 3 }, tx), (e: any) => e.name === 'ZodError');
      await assert.rejects(updateSunnahPreferences('sf-user', {}, tx), (e: any) => e.name === 'ZodError');
      const ctx = await qadaReminderContext(tx, 'sf-user', 'Africa/Cairo', new Date('2026-11-15T19:00:00Z'));
      assert.deepEqual(ctx, { coversTomorrow: false, hijriOffsetDays: -1 }, 'no qada owed → sunnah reminder may go out');
      console.log('sunnah fasting DB flow passed (rolled back)');
      throw rollback;
    }, { timeout: 60000 });
  } catch (e) { if (e !== rollback) throw e; }
}

routes().then(db).then(async () => {
  await prisma.$disconnect().catch(() => undefined);
  console.log(`sunnah fasting tests: ALL PASSED (${Object.keys(FASTING_EVIDENCE).length} evidence texts, ${OCCASIONS.length} occasions)`);
  process.exit(0);
}).catch((e) => { console.error(e); process.exit(1); });
