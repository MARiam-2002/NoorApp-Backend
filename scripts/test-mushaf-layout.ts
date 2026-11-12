/**
 * Printed-page layout (QCF V2/V4): heading and basmala placement checked on all 604 pages of the real layout
 * (scripts/fixtures/qcf-v2-page-structure.json), plus invariants, font URLs and route validation. No network.
 *
 *   npx tsx scripts/test-mushaf-layout.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { buildMushafLines, getMushafFontCatalog, mushafFontFiles, BASMALA_QPC_HAFS, type LayoutWord, type LayoutLine } from '../src/services/mushaf-layout.service';
import { mushafRouter } from '../src/routes/mushaf';
import { CATALOG_SURAHS } from '../src/data/surahs';

type PageStructure = { page: number; lines: number[]; starts: Array<[string, number]>; first: string; last: string };
const fixture = JSON.parse(readFileSync('scripts/fixtures/qcf-v2-page-structure.json', 'utf8')) as { pages: PageStructure[] };
assert.equal(fixture.pages.length, 604);

/** Synthetic words that reproduce the page's real line occupancy, surah starts and last verse. */
function wordsFor(p: PageStructure): LayoutWord[] {
  const [firstSurah] = p.first.split(':').map(Number);
  const [lastSurah, lastAyah] = p.last.split(':').map(Number);
  const startByLine = new Map(p.starts.map(([key, line]) => [line, Number(key.split(':')[0])]));
  let surah = firstSurah!;
  const words: LayoutWord[] = [];
  for (const line of p.lines) {
    const starting = startByLine.get(line);
    if (starting !== undefined) {
      surah = starting;
      words.push({ verseKey: `${surah}:1`, surah, ayah: 1, position: 1, line, glyph: 'ﱁ', type: 'word' });
    } else {
      words.push({ verseKey: `${surah}:2`, surah, ayah: 2, position: 3, line, glyph: 'ﱂ', type: 'word' });
    }
  }
  words.push({ verseKey: `${lastSurah}:${lastAyah}`, surah: lastSurah!, ayah: lastAyah!, position: 9, line: p.lines[p.lines.length - 1]!, glyph: 'ﱃ', type: 'end' });
  return words;
}

const headings = new Map<number, number>(); // surah → page of its heading
const basmalas = new Map<number, number>();
for (const p of fixture.pages) {
  const lines = buildMushafLines(p.page, wordsFor(p));
  assert.equal(lines.length, p.page <= 2 ? Math.max(...p.lines) : 15, `page ${p.page} line count`);
  lines.forEach((l, i) => assert.equal(l.line, i + 1));
  for (const l of lines) {
    if (l.kind === 'surah_header') { assert.ok(!headings.has(l.surah), `surah ${l.surah} heading once`); headings.set(l.surah, p.page); assert.ok(l.nameAr.length > 0); }
    if (l.kind === 'basmala') { assert.ok(!basmalas.has(l.surah)); basmalas.set(l.surah, p.page); }
    if (l.kind === 'text') assert.ok(l.words.length > 0);
  }
}
// Every surah has exactly one heading; every surah except al-Fatihah (basmala is verse 1) and at-Tawbah has a basmala line.
assert.equal(headings.size, 114);
assert.equal(basmalas.size, 112);
assert.ok(!basmalas.has(1) && !basmalas.has(9));
// A heading is on the page where the surah starts, or on the page before it (last line).
for (const s of CATALOG_SURAHS) {
  const startPage = fixture.pages.find(p => p.starts.some(([k]) => k === `${s.id}:1`))!.page;
  const h = headings.get(s.id)!;
  assert.ok(h === startPage || h === startPage - 1, `surah ${s.id} heading page`);
  if (s.id !== 1 && s.id !== 9) assert.equal(basmalas.get(s.id), startPage, `surah ${s.id} basmala page`);
}
const split = CATALOG_SURAHS.filter(s => headings.get(s.id) !== fixture.pages.find(p => p.starts.some(([k]) => k === `${s.id}:1`))!.page);
assert.equal(split.length, 21, 'headings on the previous page (end of page)');

// Known pages.
const page = (n: number) => buildMushafLines(n, wordsFor(fixture.pages[n - 1]!));
const kinds = (ls: LayoutLine[]) => ls.map(l => l.kind === 'text' ? 't' : l.kind === 'basmala' ? 'b' : `h${l.surah}`).join(' ');
assert.equal(kinds(page(1)), 'h1 t t t t t t t');
assert.equal(kinds(page(2)), 'h2 b t t t t t t');
assert.equal(kinds(page(187)), 'h9 t t t t t t t t t t t t t t');
assert.equal(kinds(page(604)), 'h112 b t t h113 b t t t h114 b t t t t');
assert.equal(kinds(page(76)).split(' ').at(-1), 'h4');
assert.equal(kinds(page(77)).split(' ')[0], 'b');

// Invariants are enforced, not guessed.
assert.throws(() => buildMushafLines(3, []), /Empty page/);
assert.throws(() => buildMushafLines(3, [{ verseKey: '2:6', surah: 2, ayah: 6, position: 1, line: 16, glyph: 'x', type: 'word' }]), /Invalid line/);
const broken = wordsFor(fixture.pages[49]!).filter(w => w.line !== 4); // page 50 with an unexplained empty line
assert.throws(() => buildMushafLines(50, broken));
const midPage = wordsFor(fixture.pages[2]!).filter(w => w.line !== 7);
assert.throws(() => buildMushafLines(3, midPage), /Unexpected empty line/);

// Fonts.
assert.deepEqual(mushafFontFiles('qcf_v2', 77), { id: 'qcf_v2', family: 'p77-v2', colored: false,
  ttfUrl: 'https://verses.quran.foundation/fonts/quran/hafs/v2/ttf/p77.ttf', woff2Url: 'https://verses.quran.foundation/fonts/quran/hafs/v2/woff2/p77.woff2' });
assert.equal(mushafFontFiles('qcf_v4_tajweed', 1).ttfUrl, 'https://verses.quran.foundation/fonts/quran/hafs/v4/colrv1/ttf/p1.ttf');
const catalog = getMushafFontCatalog();
assert.equal(catalog.totalPages, 604);
assert.deepEqual(catalog.fonts.map(f => f.id), ['qcf_v2', 'qcf_v4_tajweed']);
assert.equal(BASMALA_QPC_HAFS.split(' ').length, 4);

async function routes() {
  const app = express();
  app.use('/quran', mushafRouter);
  app.use(((error: any, _req: any, res: any, _next: any) => {
    res.status(error.statusCode ?? error.status ?? (error.name === 'ZodError' ? 400 : 500)).json({ success: false });
  }) as express.ErrorRequestHandler);
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/quran`;
    const fonts = await fetch(`${base}/mushaf/fonts`);
    assert.equal(fonts.status, 200);
    assert.equal(((await fonts.json()) as any).data.fonts.length, 2);
    for (const bad of ['madani-hafs/pages/0/layout', 'madani-hafs/pages/605/layout', 'madani-hafs/pages/1/layout?font=v9', 'unknown/pages/1/layout']) {
      assert.equal((await fetch(`${base}/editions/${bad}`)).status, 400, bad);
    }
    assert.equal((await fetch(`${base}/editions/indopak-hafs/pages/1/layout`)).status, 409);
    assert.equal((await fetch(`${base}/home`)).status, 401, 'Quran home is private');
  } finally { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
}

routes().then(() => {
  console.log(`mushaf layout tests: ALL PASSED (604 pages, 114 headings, ${split.length} at the end of the previous page)`);
  process.exit(0);
}).catch((e) => { console.error(e); process.exit(1); });
