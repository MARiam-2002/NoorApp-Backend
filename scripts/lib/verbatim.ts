/**
 * Test helper: a hadith text shown in the app must be the edition's words under the cited number, letter AND vowel (canonical mark order)
 * (Unicode NFC, so shadda/vowel order does not matter; punctuation and spacing ignored). `corrections` are documented edition typos fixed in the shown text.
 */
import { findSahihPhrase, tirmidhiGrades, type SahihCollection } from './sahihayn-lookup';

const strict = (s: string) => s.normalize('NFC').replace(/[^ء-ْٰ\s]/g, ' ').replace(/\s+/g, ' ').trim();

export function assertVerbatimHadith(
  h: { id: string; collection: SahihCollection; number: number; textAr: string; referenceAr: string },
  corrections: { from: string; to: string }[] = [],
) {
  let edition = h.textAr;
  for (const c of corrections) {
    if (!h.textAr.includes(c.to)) throw new Error(`${h.id}: correction «${c.to}» not in the shown text`);
    edition = edition.replace(c.to, c.from);
  }
  const hits = findSahihPhrase(h.collection, edition).filter((x) => x.number === h.number);
  if (!hits.length) throw new Error(`${h.id}: words not found in ${h.collection} ${h.number}`);
  if (!hits.some((x) => strict(x.excerptAr) === strict(edition))) {
    throw new Error(`${h.id}: vowels differ from ${h.collection} ${h.number}\n  edition: ${strict(hits[0].excerptAr)}\n  shown:   ${strict(edition)}`);
  }
  if (!h.referenceAr.includes(`(${h.number})`)) throw new Error(`${h.id}: reference must name ${h.number}`);
  if (h.collection === 'tirmidhi' || h.collection === 'abudawud') {
    const grade = tirmidhiGrades(h.number, h.collection)['Al-Albani'];
    const expected = grade === 'Hasan Sahih' ? 'وقال الألباني: حسن صحيح' : /^Sahih/.test(grade ?? '') ? 'وصححه الألباني' : /^Hasan/.test(grade ?? '') ? 'وحسّنه الألباني' : null;
    if (!expected) throw new Error(`${h.id}: al-Albani grade is ${grade ?? 'missing'}, not sahih or hasan`);
    if (!h.referenceAr.includes(expected)) throw new Error(`${h.id}: reference must say «${expected}»`);
  }
}
