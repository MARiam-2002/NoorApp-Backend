/**
 * Automatic recitation check ("التسميع التلقائي"). The app records the reader and turns speech into text with the
 * device's Arabic speech recognition; this service aligns that transcript with the expected verses word by word and
 * reports, for every expected word: CORRECT, MINOR (spelling-level difference typical of speech recognition),
 * WRONG (another word said) or MISSED, plus EXTRA words said that are not in the text.
 *
 * Matching is done on the written skeleton (no diacritics, unified alef/ya/ta marbuta/hamza seats), because speech
 * recognition does not return vowel marks. It checks the words and their order — not tajweed or vowel accuracy.
 */
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { ErrorCodes } from '../config';
import { CATALOG_SURAHS } from '../data/surahs';
import { sanitizeAyahText } from './quran.service';

export const recitationCheckSchema = z.object({
  surahId: z.number().int().min(1).max(114),
  fromAyah: z.number().int().min(1).max(286),
  toAyah: z.number().int().min(1).max(286),
  transcript: z.string().trim().min(1).max(20000),
}).strict();

/** Written skeleton used for comparison. */
export function skeleton(word: string): string {
  return word.normalize('NFC')
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '')
    .replace(/[ٱأإآا]/g, 'ا').replace(/[ىي]/g, 'ي').replace(/ة/g, 'ه').replace(/[ؤئء]/g, 'ء')
    .replace(/[^ء-ي]/g, '');
}

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]!; dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]!;
      dp[j] = Math.min(dp[j]! + 1, dp[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length]!;
}

/**
 * 0 = same word, 1 = minor difference, 2 = different word. Handles the common alef-drop of Uthmani spelling.
 * A minor difference is only possible in words of 4+ letters (one letter per 4): in short words one letter changes the
 * word itself (أحد / واحد, لم / لن), which is a real recitation mistake, not a speech-recognition slip.
 */
export function wordDistance(expected: string, said: string): 0 | 1 | 2 {
  const e = skeleton(expected), s = skeleton(said);
  if (!e || !s) return 2;
  if (e === s || e.replace(/ا/g, '') === s.replace(/ا/g, '')) return 0;
  const shorter = Math.min(e.length, s.length);
  if (shorter < 4) return 2;
  return editDistance(e, s) <= Math.floor(shorter / 4) ? 1 : 2;
}

export type ExpectedWord = { verseKey: string; position: number; text: string };
export type WordResult = ExpectedWord & { status: 'CORRECT' | 'MINOR' | 'WRONG' | 'MISSED'; heard: string | null };

/** Needleman–Wunsch alignment of expected words against the heard words. */
export function alignRecitation(expected: ExpectedWord[], heardText: string) {
  const heard = heardText.split(/\s+/).map(w => w.trim()).filter(w => skeleton(w).length > 0);
  const n = expected.length, m = heard.length;
  const GAP = 1, SUB = [0, 0.4, 1.4];
  const score = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  for (let i = 1; i <= n; i++) score[i]![0] = i * GAP;
  for (let j = 1; j <= m; j++) score[0]![j] = j * GAP;
  const dist = (i: number, j: number) => wordDistance(expected[i]!.text, heard[j]!);
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    score[i]![j] = Math.min(score[i - 1]![j - 1]! + SUB[dist(i - 1, j - 1)]!, score[i - 1]![j]! + GAP, score[i]![j - 1]! + GAP);
  }
  const words: WordResult[] = [];
  const extra: Array<{ heard: string; afterVerseKey: string | null; afterPosition: number | null }> = [];
  let i = n, j = m;
  const rev: Array<WordResult | { extra: string; at: number }> = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && Math.abs(score[i]![j]! - (score[i - 1]![j - 1]! + SUB[dist(i - 1, j - 1)]!)) < 1e-9) {
      const d = dist(i - 1, j - 1);
      rev.push({ ...expected[i - 1]!, status: d === 0 ? 'CORRECT' : d === 1 ? 'MINOR' : 'WRONG', heard: heard[j - 1]! });
      i--; j--;
    } else if (i > 0 && Math.abs(score[i]![j]! - (score[i - 1]![j]! + GAP)) < 1e-9) {
      rev.push({ ...expected[i - 1]!, status: 'MISSED', heard: null }); i--;
    } else {
      rev.push({ extra: heard[j - 1]!, at: i }); j--;
    }
  }
  for (const r of rev.reverse()) {
    if ('extra' in r) {
      const prev = r.at > 0 ? expected[r.at - 1]! : null;
      extra.push({ heard: r.extra, afterVerseKey: prev?.verseKey ?? null, afterPosition: prev?.position ?? null });
    } else words.push(r);
  }
  // A recitation stopped early is not a mistake: trailing missed words are "not reached" and are left out of the
  // counts and the accuracy (their status stays MISSED; the app shows every word after `stoppedAt` as neutral).
  let reached = n;
  while (reached > 0 && words[reached - 1]!.status === 'MISSED') reached--;
  const counts = { correct: 0, minor: 0, wrong: 0, missed: 0, notReached: n - reached };
  for (const w of words.slice(0, reached)) counts[w.status.toLowerCase() as 'correct' | 'minor' | 'wrong' | 'missed']++;
  const accuracy = reached ? Math.round(((counts.correct + counts.minor) / reached) * 1000) / 10 : 0;
  return { words, extra, counts, accuracy, reachedWords: reached, totalWords: n,
    stoppedAt: reached < n && reached > 0 ? { verseKey: words[reached - 1]!.verseKey, position: words[reached - 1]!.position } : null };
}

export async function checkRecitation(raw: unknown, db: any = prisma) {
  const v = recitationCheckSchema.parse(raw);
  const surah = CATALOG_SURAHS.find(s => s.id === v.surahId)!;
  if (v.fromAyah > v.toAyah || v.toAyah > surah.totalAyahs) throw new AppError('Invalid verse range', 400, ErrorCodes.VALIDATION_ERROR);
  if (v.toAyah - v.fromAyah > 49) throw new AppError('Check at most 50 verses at a time', 400, ErrorCodes.VALIDATION_ERROR);
  const rows: any[] = await db.$queryRaw`SELECT "surahId","ayahNumber","textAr" FROM "ayahs" WHERE "surahId"=${v.surahId} AND "ayahNumber" BETWEEN ${v.fromAyah} AND ${v.toAyah} ORDER BY "ayahNumber"`;
  if (rows.length !== v.toAyah - v.fromAyah + 1) throw new AppError('Quran text unavailable', 503, ErrorCodes.INTERNAL_SERVER_ERROR);
  const expected: ExpectedWord[] = rows.flatMap(r => {
    const a = sanitizeAyahText({ surahId: Number(r.surahId), ayahNumber: Number(r.ayahNumber), textAr: String(r.textAr) });
    return a.textAr.split(/\s+/).filter(w => skeleton(w).length > 0).map((text, k) => ({ verseKey: `${a.surahId}:${a.ayahNumber}`, position: k + 1, text }));
  });
  return { surahId: v.surahId, fromAyah: v.fromAyah, toAyah: v.toAyah, ...alignRecitation(expected, v.transcript),
    note: 'يقارن الكلمات وترتيبها فقط، ولا يحكم على أحكام التجويد أو الحركات.' };
}
