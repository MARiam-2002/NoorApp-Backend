import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { env, ErrorCodes } from '../config';
import { AppError } from '../lib/errors';

export const WARSH_SOURCE_SHA256 = '4f1ca6245b059aafa3917e1ef06bd22e70d27f7b417f303e97dbcb5d60b77f7a';
export const WARSH_CONTENT_VERSION = `qul-warsh-${WARSH_SOURCE_SHA256}`;
export const WARSH_TOTAL_VERSES = 6214;
const verseSchema = z.object({ id: z.number().int().positive(), verse_key: z.string(), surah: z.number().int().min(1).max(114), ayah: z.number().int().positive(), text: z.string().min(1) }).strict();
export type WarshVerse = { key: string; surah: number; ayah: number; text: string; ordinal: number };
let cached: WarshVerse[] | undefined;
export function validateWarshSource(bytes: Buffer): WarshVerse[] {
  if (createHash('sha256').update(bytes).digest('hex') !== WARSH_SOURCE_SHA256) throw new Error('Warsh source checksum mismatch');
  const records = z.record(z.string(), verseSchema).parse(JSON.parse(bytes.toString('utf8')));
  const verses = Object.entries(records).map(([key, v]) => {
    if (key !== v.verse_key || key !== `${v.surah}:${v.ayah}` || !v.text.trim()) throw new Error('Invalid Warsh verse identity');
    return { key, surah: v.surah, ayah: v.ayah, text: v.text, ordinal: 0 };
  }).sort((a,b) => a.surah - b.surah || a.ayah - b.ayah);
  if (verses.length !== WARSH_TOTAL_VERSES) throw new Error('Incomplete Warsh source');
  let surah = 1; let ayah = 0;
  verses.forEach((v, i) => {
    if (v.surah !== surah) { if (v.surah !== surah + 1 || v.ayah !== 1) throw new Error('Missing Warsh surah'); surah = v.surah; ayah = 0; }
    if (v.ayah !== ayah + 1) throw new Error('Missing Warsh ayah');
    ayah = v.ayah; v.ordinal = i + 1;
  });
  if (surah !== 114 || ayah !== 6) throw new Error('Incomplete final Warsh surah');
  return verses;
}
function source() {
  if (!cached) cached = validateWarshSource(readFileSync(join(__dirname, '../shared/data/qpc-warsh-script-ayah.json')));
  return cached;
}
export function getWarshCapability() {
  try { source(); return { available: env.WARSH_TEXT_APPROVED, reason: env.WARSH_TEXT_APPROVED ? null : 'TEXT_RELEASE_APPROVAL_REQUIRED', contentVersion: WARSH_CONTENT_VERSION, totalVerses: WARSH_TOTAL_VERSES }; }
  catch { return { available: false, reason: 'WARSH_SOURCE_INVALID', contentVersion: WARSH_CONTENT_VERSION, totalVerses: WARSH_TOTAL_VERSES }; }
}
export function requireWarsh() {
  const capability = getWarshCapability();
  if (!capability.available) throw new AppError('Warsh text release is unavailable', 503, ErrorCodes.WARSH_SOURCE_UNAVAILABLE, { reason: capability.reason });
  return source();
}
export function warshVerse(key: string) {
  const v = requireWarsh().find(item => item.key === key);
  if (!v) throw new AppError('Verse key does not exist in this Warsh source', 400, ErrorCodes.VALIDATION_ERROR);
  return v;
}
export function warshChapters() {
  const verses = requireWarsh();
  return { editionId: 'warsh-nafi', contentVersion: WARSH_CONTENT_VERSION, unit: 'VERSE', totalVerses: WARSH_TOTAL_VERSES, chapters: Array.from({ length: 114 }, (_, i) => ({ surah: i + 1, totalAyahs: verses.filter(v => v.surah === i + 1).length })) };
}
export function warshChapter(surah: number, fromAyah: number, limit: number) {
  const all = requireWarsh().filter(v => v.surah === surah);
  if (fromAyah > all.length) throw new AppError('Ayah outside this Warsh surah', 400, ErrorCodes.VALIDATION_ERROR);
  const verses = all.slice(fromAyah - 1, fromAyah - 1 + limit);
  return { editionId: 'warsh-nafi', contentVersion: WARSH_CONTENT_VERSION, surah, totalAyahs: all.length, verses, nextFromAyah: fromAyah - 1 + verses.length < all.length ? fromAyah + verses.length : null };
}
