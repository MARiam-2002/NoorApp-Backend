import assert from 'node:assert/strict';
import { listReciters, getAyahAudio } from '../src/services/quran.service';
import { prisma } from '../src/lib/prisma';

async function main() {
  const readers = await listReciters();
  assert.equal(readers[0].id, 'Mishary_Alafasy');
  const banna = readers.find(r => r.id === 'Mahmoud_Ali_Al_Banna');
  assert.ok(banna);
  assert.equal(banna.resourceId, undefined, 'Do not invent a Quran Foundation resource id');
  for (const [surah, ayah] of [[1, 1], [2, 255], [114, 6]]) {
    const audio = await getAyahAudio(surah, ayah, banna.id);
    assert.equal(audio.reciter, banna.id);
    assert.equal(audio.provider, 'everyayah');
    assert.equal(audio.audioUrl, `${banna.serverUrl}/${String(surah).padStart(3, '0')}${String(ayah).padStart(3, '0')}.mp3`);
  }
  console.log('Banna catalog, verse audio and unchanged default passed');
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
