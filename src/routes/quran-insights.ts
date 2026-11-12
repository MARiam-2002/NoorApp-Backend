import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import { getAyahInsights, getSurahInsightMarkers, getSurahVirtues } from '../services/quran-insights.service';

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
