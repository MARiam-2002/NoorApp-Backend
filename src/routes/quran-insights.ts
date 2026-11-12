import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import { getAyahInsights, getSurahInsightMarkers, getSurahVirtues } from '../services/quran-insights.service';
import { getAyahLibrary, getAyahWords, getWord, getRootOccurrences, getTopicTree, getTopic, getSurahInfo, getRubIndex, searchByMeaning } from '../services/quran-library.service';
import { checkRecitation } from '../services/recitation-check.service';
import { getSurahAudioCatalog } from '../services/surah-audio.service';
import { authenticate } from '../middleware/auth';
import { KHATMAH_TEMPLATES } from '../shared/data/khatmah-templates';

/** Public, static content: GET /quran/insights?surahId&ayahNumber · /quran/surahs/:id/virtues · /quran/surahs/:id/insight-markers */
export const quranInsightsRouter = Router();
const surahId = z.coerce.number().int().min(1).max(114);
quranInsightsRouter.get('/insights', asyncHandler(async (req, res) => {
  const q = z.object({ surahId, ayahNumber: z.coerce.number().int().min(1).max(286) }).strict().parse(req.query);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  sendSuccess(res, getAyahInsights(q.surahId, q.ayahNumber), 'Verse insights', req);
}));
quranInsightsRouter.get('/surahs/:surahId/virtues', asyncHandler(async (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=86400');
  sendSuccess(res, getSurahVirtues(surahId.parse(req.params.surahId)), 'Surah virtues', req);
}));
quranInsightsRouter.get('/surahs/:surahId/insight-markers', asyncHandler(async (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=86400');
  sendSuccess(res, getSurahInsightMarkers(surahId.parse(req.params.surahId)), 'Surah insight markers', req);
}));
const verse = z.object({ surahId, ayahNumber: z.coerce.number().int().min(1).max(286) }).strict();
const day = (res: any) => res.setHeader('Cache-Control', 'public, max-age=86400');
/** Verse panel (tab «الآية»): المختصر، الإعراب، القراءات، المتشابهات، الموضوعات + meanings, causes of revelation, virtues. */
quranInsightsRouter.get('/ayah-library', asyncHandler(async (req, res) => {
  const q = verse.parse(req.query); day(res);
  sendSuccess(res, { ...getAyahLibrary(q.surahId, q.ayahNumber), insights: getAyahInsights(q.surahId, q.ayahNumber) }, 'Verse library', req);
}));
/** Every word of a verse with morphology, root, statistics and word audio. */
quranInsightsRouter.get('/ayah-words', asyncHandler(async (req, res) => {
  const q = verse.parse(req.query); day(res); sendSuccess(res, getAyahWords(q.surahId, q.ayahNumber), 'Verse words', req);
}));
/** Word panel (tab «الكلمة»): segments, root, lemma, statistics, qiraat of this word, audio. */
quranInsightsRouter.get('/word', asyncHandler(async (req, res) => {
  const q = verse.extend({ position: z.coerce.number().int().min(1).max(200) }).strict().parse(req.query); day(res);
  sendSuccess(res, getWord(q.surahId, q.ayahNumber, q.position), 'Word details', req);
}));
quranInsightsRouter.get('/roots/:root', asyncHandler(async (req, res) => {
  const root = z.string().trim().min(2).max(6).regex(/^[\u0621-\u064A]+$/).parse(req.params.root); day(res);
  sendSuccess(res, getRootOccurrences(root), 'Root occurrences', req);
}));
quranInsightsRouter.get('/topics', asyncHandler(async (req, res) => { day(res); sendSuccess(res, getTopicTree(), 'Quran topics', req); }));
quranInsightsRouter.get('/topics/:id', asyncHandler(async (req, res) => {
  day(res); sendSuccess(res, getTopic(z.coerce.number().int().positive().parse(req.params.id)), 'Quran topic', req);
}));
/** Surah sciences (tab «علوم»): introduction, names, revelation, topics, purposes, counting differences, statistics. */
quranInsightsRouter.get('/surahs/:surahId/info', asyncHandler(async (req, res) => {
  const id = surahId.parse(req.params.surahId); day(res);
  sendSuccess(res, { ...getSurahInfo(id), virtues: getSurahVirtues(id).virtues }, 'Surah info', req);
}));
quranInsightsRouter.get('/index/rub', asyncHandler(async (req, res) => { day(res); sendSuccess(res, { rubs: getRubIndex() }, 'Rub index', req); }));
quranInsightsRouter.get('/khatmah/templates', asyncHandler(async (req, res) => { day(res); sendSuccess(res, { templates: KHATMAH_TEMPLATES }, 'Khatmah templates', req); }));
/** Search by meaning (المختصر + topics). */
quranInsightsRouter.get('/search/meaning', asyncHandler(async (req, res) => {
  const q = z.object({ q: z.string().trim().min(2).max(200), limit: z.coerce.number().int().min(1).max(100).default(50) }).strict().parse(req.query); day(res);
  sendSuccess(res, searchByMeaning(q.q, q.limit), 'Meaning search', req);
}));
/** Automatic recitation check: transcript from the device's Arabic speech recognition → word-by-word result. */
quranInsightsRouter.post('/recitation/check', authenticate, asyncHandler(async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  sendSuccess(res, await checkRecitation(req.body), 'Recitation checked', req);
}));
/** Full-surah recitations (many reciters and riwayat) for continuous listening and download. */
quranInsightsRouter.get('/audio/surah-reciters', asyncHandler(async (req, res) => {
  const q = z.object({ riwaya: z.string().max(60).optional() }).strict().parse(req.query); day(res);
  sendSuccess(res, getSurahAudioCatalog(q.riwaya), 'Surah reciters', req);
}));
