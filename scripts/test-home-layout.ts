/**
 * GET/PUT /profile/home-layout — section order/visibility and tool shortcuts, synced with a revision guard.
 *
 *   HOME_LAYOUT_TEST_DB=true npx tsx scripts/test-home-layout.ts
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DEFAULT_HOME_TOOLS, HOME_SECTION_IDS, homeLayoutPutSchema, normalizeHomeLayout } from '../src/services/home-layout.service';

// --- Pure rules (always run) ---
{
  const empty = normalizeHomeLayout(null);
  assert.deepEqual(empty.sections.map(s => s.id), [...HOME_SECTION_IDS]);
  assert.ok(empty.sections.every(s => s.visible));
  assert.deepEqual(empty.tools, [...DEFAULT_HOME_TOOLS]);
  assert.equal(empty.revision, 0);

  // Stored by an older/newer app: unknown ids dropped, duplicates dropped, missing sections appended visible.
  const old = normalizeHomeLayout({
    sections: [{ id: 'tools', visible: false }, { id: 'retired_section', visible: true }, { id: 'tools', visible: true }, { id: 'today', visible: true }],
    tools: ['kahf', 'kahf', 'unknown_tool', 'qibla'],
    revision: 4,
  });
  assert.deepEqual(old.sections, [
    { id: 'tools', visible: false }, { id: 'today', visible: true },
    { id: 'continue', visible: true }, { id: 'challenge', visible: true }, { id: 'daily_inspiration', visible: true },
  ]);
  assert.deepEqual(old.tools, ['kahf', 'qibla']);
  assert.equal(old.revision, 4);

  const sections = HOME_SECTION_IDS.map(id => ({ id, visible: id !== 'challenge' }));
  assert.ok(homeLayoutPutSchema.safeParse({ sections, tools: ['qibla'], expectedRevision: 0 }).success);
  assert.ok(homeLayoutPutSchema.safeParse({ sections, tools: [], expectedRevision: 0 }).success, 'no tools is allowed');
  assert.equal(homeLayoutPutSchema.safeParse({ sections: sections.slice(1), tools: [], expectedRevision: 0 }).success, false, 'every section once');
  assert.equal(homeLayoutPutSchema.safeParse({ sections: [...sections.slice(1), sections[1]], tools: [], expectedRevision: 0 }).success, false, 'no duplicate section');
  assert.equal(homeLayoutPutSchema.safeParse({ sections, tools: ['qibla', 'qibla'], expectedRevision: 0 }).success, false, 'no duplicate tool');
  assert.equal(homeLayoutPutSchema.safeParse({ sections, tools: ['qibla', 'tasbih', 'fasting_qada', 'rawatib', 'sajdah', 'zakat', 'sadaqah', 'prayer_times', 'kahf'], expectedRevision: 0 }).success, false, 'at most 8 tools');
  assert.equal(homeLayoutPutSchema.safeParse({ sections, tools: ['weather'], expectedRevision: 0 }).success, false, 'unknown tool');
  assert.equal(homeLayoutPutSchema.safeParse({ sections, tools: [], expectedRevision: 0, extra: 1 }).success, false, 'strict body');
  console.log('home layout pure rules: PASSED');
}

if (process.env.HOME_LAYOUT_TEST_DB !== 'true') {
  console.log('SKIP home layout DB checks (set HOME_LAYOUT_TEST_DB=true with a test database)');
  process.exit(0);
}

async function main() {
  const { prisma } = await import('../src/lib/prisma');
  const { getHomeLayout, putHomeLayout } = await import('../src/services/home-layout.service');
  const id = randomUUID();
  const stamp = Date.now();
  await prisma.$executeRaw`INSERT INTO "users" ("id","username","email","updatedAt") VALUES (${id}, ${`home_layout_${stamp}`}, ${`home-layout-${stamp}@noor-test.local`}, CURRENT_TIMESTAMP)`;
  try {
    const first = await getHomeLayout(id);
    assert.equal(first.revision, 0);
    assert.deepEqual(first.catalog.sections, [...HOME_SECTION_IDS]);

    const sections = [
      { id: 'today', visible: true }, { id: 'continue', visible: true }, { id: 'daily_inspiration', visible: true },
      { id: 'tools', visible: true }, { id: 'challenge', visible: false },
    ];
    const saved = await putHomeLayout(id, { sections, tools: ['qibla', 'kahf', 'fasting_qada'], expectedRevision: 0 }, new Date('2026-11-14T01:00:00Z'));
    assert.equal(saved.revision, 1);
    assert.equal(saved.updatedAt, '2026-11-14T01:00:00.000Z');

    const again = await getHomeLayout(id);
    assert.deepEqual(again.sections, sections);
    assert.deepEqual(again.tools, ['qibla', 'kahf', 'fasting_qada']);

    // Another device saved in between: 409 with the current revision, nothing changed.
    await assert.rejects(putHomeLayout(id, { sections, tools: [], expectedRevision: 0 }), (e: any) =>
      e.statusCode === 409 && e.details?.reason === 'HOME_LAYOUT_REVISION' && e.details?.currentRevision === 1);
    assert.deepEqual((await getHomeLayout(id)).tools, ['qibla', 'kahf', 'fasting_qada']);

    await assert.rejects(getHomeLayout(randomUUID()), (e: any) => e.statusCode === 404);
    console.log('home layout DB checks: ALL PASSED (default, save, revision guard, unknown user)');
  } finally {
    await prisma.$executeRaw`DELETE FROM "users" WHERE "id" = ${id}`;
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
