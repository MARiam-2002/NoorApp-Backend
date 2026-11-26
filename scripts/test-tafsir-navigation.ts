/**
 * Tafsir sheet navigation: previous / next ayah around a passage, across surah boundaries, one step per ayah group.
 *
 *   npx tsx scripts/test-tafsir-navigation.ts
 */
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { errorHandler } from '../src/middleware/common';
import { quranRouter } from '../src/routes/quran';
import { getAyahTafsir, tafsirNeighbors } from '../src/services/quran.service';

// Inside a surah.
assert.deepEqual(tafsirNeighbors(2, 10), {
  previous: { surahId: 2, ayahNumber: 9 },
  next: { surahId: 2, ayahNumber: 11 },
  surahAyahCount: 286,
});

// First and last ayah of the mushaf.
assert.equal(tafsirNeighbors(1, 1).previous, null);
assert.deepEqual(tafsirNeighbors(1, 1).next, { surahId: 1, ayahNumber: 2 });
assert.equal(tafsirNeighbors(114, 6).next, null);
assert.deepEqual(tafsirNeighbors(114, 6).previous, { surahId: 114, ayahNumber: 5 });

// Across surahs: Al-Fatiha 7 → Al-Baqarah 1, Al-Baqarah 1 → Al-Fatiha 7.
assert.deepEqual(tafsirNeighbors(1, 7).next, { surahId: 2, ayahNumber: 1 });
assert.deepEqual(tafsirNeighbors(2, 1).previous, { surahId: 1, ayahNumber: 7 });
assert.deepEqual(tafsirNeighbors(2, 286).next, { surahId: 3, ayahNumber: 1 });
assert.deepEqual(tafsirNeighbors(3, 1).previous, { surahId: 2, ayahNumber: 286 });

// A grouped passage (Nuh 1–4) is one step: previous is the end of Al-Ma'arij, next is Nuh 5.
assert.deepEqual(tafsirNeighbors(71, 1, 4), {
  previous: { surahId: 70, ayahNumber: 44 },
  next: { surahId: 71, ayahNumber: 5 },
  surahAyahCount: 28,
});

// Out-of-range input is clamped, never produces a reference past the surah.
assert.deepEqual(tafsirNeighbors(112, 9).next, { surahId: 113, ayahNumber: 1 });

(async () => {
  // The verified Muyassar passage carries its group, which drives the step.
  const r = await getAyahTafsir(71, 2, 'Ibn_Kathir_Muyassar');
  const nav = tafsirNeighbors(71, r.groupFromAyah ?? 2, r.groupToAyah ?? 2);
  assert.deepEqual(nav.next, { surahId: 71, ayahNumber: 5 });

  // GET /quran/tafsir returns the navigation fields with the passage (additive; old fields unchanged).
  const app = express();
  app.use('/quran', quranRouter);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((r) => server.once('listening', r));
    const port = (server.address() as AddressInfo).port;
    const res = await fetch(`http://127.0.0.1:${port}/quran/tafsir?surahId=71&ayahNumber=2&tafsirId=Ibn_Kathir_Muyassar`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { data: Record<string, unknown> };
    assert.equal(body.data.textAr, r.textAr);
    assert.deepEqual(body.data.previous, { surahId: 70, ayahNumber: 44 });
    assert.deepEqual(body.data.next, { surahId: 71, ayahNumber: 5 });
    assert.equal(body.data.surahAyahCount, 28);
    assert.equal(typeof body.data.ayahTextAr, 'string');
  } finally {
    server.close();
  }
  console.log('tafsir navigation tests: ALL PASSED');
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
