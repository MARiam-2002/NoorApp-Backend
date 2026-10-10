import assert from 'node:assert/strict';
import express from 'express';
import { prisma } from '../src/lib/prisma';
import { getNawafelPreferences, updateNawafelPreferences, getNawafelToday, getNawafelDashboardTile, setNawafelCompletion, nawafelPreferencesPatchSchema } from '../src/services/nawafel.service';
import { NAWAFEL_KEYS } from '../src/shared/constants/nawafel';
import { profileRouter } from '../src/routes/profile';
import { nawafelRouter } from '../src/routes/nawafel';
import { errorHandler } from '../src/middleware/common';
import { generateAccessToken } from '../src/lib/auth';
import { getSwaggerSpec } from '../src/lib/swagger';

async function main() {
  const db = prisma as any;
  const originalUser = db.user.findUnique, originalRaw = db.$executeRaw;
  const delegate = db.nawafelCompletion;
  const originals = Object.fromEntries(['findMany','upsert','deleteMany'].map(key => [key, delegate[key]]));
  const users = new Map<string, any>([['owner', { id: 'owner', isActive: true, timezone: 'Africa/Cairo', nawafelPreferences: null }], ['other', { id: 'other', isActive: true, timezone: 'Pacific/Kiritimati', nawafelPreferences: null }]]);
  const rows = new Map<string, any>();
  let server: any;
  db.user.findUnique = async ({ where }: any) => users.get(where.id) ?? null;
  db.$executeRaw = async (_parts: any, patch: string, userId: string) => {
    const user = users.get(userId); if (!user) return 0;
    user.nawafelPreferences = { ...(user.nawafelPreferences ?? {}), ...JSON.parse(patch) }; return 1;
  };
  delegate.findMany = async ({ where }: any) => [...rows.values()].filter(row => row.userId === where.userId && +row.date === +where.date);
  delegate.upsert = async ({ create }: any) => { const key = create.userId + '|' + create.date.toISOString() + '|' + create.key; if (!rows.has(key)) rows.set(key, { ...create, id: key }); return rows.get(key); };
  delegate.deleteMany = async ({ where }: any) => { const key = where.userId + '|' + where.date.toISOString() + '|' + where.key; return { count: rows.delete(key) ? 1 : 0 }; };
  try {
    assert.deepEqual(await getNawafelPreferences('owner'), { showOnHome: true, selectedKeys: [...NAWAFEL_KEYS] });
    assert.equal((await getNawafelToday('owner')).tracking.totalRakahs, 12);
    assert(!nawafelPreferencesPatchSchema.safeParse({ selectedKeys: ['FAJR_BEFORE_2','FAJR_BEFORE_2'] }).success);
    assert(!nawafelPreferencesPatchSchema.safeParse({ showOnHome: 'true' }).success);
    assert(!nawafelPreferencesPatchSchema.safeParse({}).success);
    await updateNawafelPreferences('owner', { selectedKeys: ['FAJR_BEFORE_2','DHUHR_BEFORE_4'] });
    await updateNawafelPreferences('owner', { showOnHome: false });
    const today = await getNawafelToday('owner');
    assert.equal(today.preferences.showOnHome, false);
    assert.equal(today.tracking.totalRakahs, 6);
    assert.equal(today.totalRakahs, 12, 'Legacy catalog totals stay compatible');
    assert.equal(today.items.filter(item => item.selected).length, 2);
    await Promise.all(Array.from({ length: 8 }, () => setNawafelCompletion('owner', 'FAJR_BEFORE_2', { completed: true, date: today.date })));
    assert.equal(rows.size, 1, 'Repeated true writes create only one record');
    const tile = await getNawafelDashboardTile('owner');
    assert.equal(tile.visible, false); assert.equal(tile.completed, 2); assert.equal(tile.total, 6); assert.equal(tile.progress, 0.33);
    assert.equal((await getNawafelToday('other')).completedRakahs, 0, 'User scopes are isolated');
    await assert.rejects(setNawafelCompletion('owner', 'ISHA_AFTER_2', { completed: true, date: today.date }), /Select/);
    await assert.rejects(setNawafelCompletion('owner', 'FAJR_BEFORE_2', { completed: true, date: '2000-01-01' }), /Local day changed/);
    await updateNawafelPreferences('owner', { selectedKeys: [] });
    const empty = await getNawafelToday('owner');
    assert.equal(empty.tracking.state, 'NONE_SELECTED'); assert.equal(empty.tracking.progress, 0); assert.equal(empty.completedRakahs, 2, 'Changing selections preserves completions');
    await updateNawafelPreferences('owner', { selectedKeys: ['FAJR_BEFORE_2'] });
    assert.equal((await getNawafelToday('owner')).tracking.progress, 1);
    await Promise.all(Array.from({ length: 8 }, () => setNawafelCompletion('owner', 'FAJR_BEFORE_2', { completed: false, date: today.date })));
    assert.equal(rows.size, 0, 'Repeated false writes remain false');
    const app = express(); app.use(express.json()); app.use('/profile', profileRouter); app.use('/nawafel', nawafelRouter); app.use(errorHandler);
    server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    const token = generateAccessToken({ userId: 'owner', email: 'fixture@example.com' });
    async function request(path: string, method='GET', body?: any, auth=true) {
      const response = await fetch(origin + path, { method, headers: { ...(auth ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
      return { status: response.status, json: await response.json(), cache: response.headers.get('cache-control') };
    }
    assert.equal((await request('/profile/nawafel-preferences', 'GET', undefined, false)).status, 401);
    assert((await request('/profile/nawafel-preferences')).cache?.includes('no-store'));
    assert.equal((await request('/profile/nawafel-preferences', 'PATCH', { selectedKeys: ['INVALID'] })).status, 400);
    assert.equal((await request('/profile/nawafel-preferences', 'PATCH', { showOnHome: true })).json.data.showOnHome, true);
    const body = { completed: true, date: today.date };
    assert.equal((await request('/nawafel/FAJR_BEFORE_2/completion', 'PUT', body)).json.data.completed, true);
    assert.equal((await request('/nawafel/FAJR_BEFORE_2/completion', 'PUT', body)).json.data.today.tracking.completedRakahs, 2);
    assert.equal((await request('/nawafel/FAJR_BEFORE_2/completion', 'PUT', { completed: false, date: '2000-01-01' })).status, 409);
    const spec = getSwaggerSpec() as any;
    assert(spec.paths['/profile/nawafel-preferences'].patch);
    assert(spec.paths['/nawafel/{key}/completion'].put);
    assert.equal(spec.paths['/nawafel/{key}/mark'].patch.deprecated, true);
    console.log('Nawafel preferences/completion checks passed: defaults, selected-only rakah progress, empty state, history preservation, owner scoping, identical concurrent retries, stale-day protection, auth, validation, private cache and Swagger. Mock DB; no production writes or pushes.');
  } finally {
    if (server) await new Promise<void>(resolve => server.close(() => resolve()));
    db.user.findUnique = originalUser; db.$executeRaw = originalRaw;
    for (const [key,value] of Object.entries(originals)) delegate[key] = value;
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
