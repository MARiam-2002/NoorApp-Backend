import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import { warshChapter, warshChapters } from '../services/warsh-content.service';
import { getWarshPosition, setWarshPosition, getWarshBookmarks, setWarshBookmark, getWarshCycle, startWarshCycle, setWarshCompletions, getWarshCompletedVerses, warshPositionSchema, warshBookmarkInputSchema, warshCycleInputSchema, warshCompletionInputSchema } from '../services/warsh-reader.service';
export const warshRouter = Router();
warshRouter.get('/chapters', asyncHandler(async (req,res) => { const data = warshChapters(); res.setHeader('Cache-Control','public, max-age=300'); sendSuccess(res,data,'Warsh chapters',req); }));
warshRouter.get('/chapters/:surah', asyncHandler(async (req,res) => {
  const surah = z.coerce.number().int().min(1).max(114).parse(req.params.surah);
  const query = z.object({ fromAyah: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(50) }).strict().parse(req.query);
  const data = warshChapter(surah,query.fromAyah,query.limit); res.setHeader('Cache-Control','public, max-age=300'); sendSuccess(res,data,'Warsh verses',req);
}));
// This router is mounted only under /quran/warsh; no authentication leaks into legacy Quran routes.
warshRouter.use((_req,res,next) => { res.setHeader('Cache-Control','private, no-store'); next(); }, authenticate);
warshRouter.get('/reader-state',asyncHandler(async (req,res) => { sendSuccess(res,await getWarshPosition(req.user!.sub),'Warsh reading position',req); }));
warshRouter.put('/reader-state',asyncHandler(async (req,res) => { sendSuccess(res,await setWarshPosition(req.user!.sub,warshPositionSchema.parse(req.body)),'Warsh reading position saved',req); }));
warshRouter.get('/bookmarks',asyncHandler(async (req,res) => {
  const q = z.object({ afterOrdinal:z.coerce.number().int().min(0).max(6214).default(0),limit:z.coerce.number().int().min(1).max(100).default(50) }).strict().parse(req.query);
  sendSuccess(res,await getWarshBookmarks(req.user!.sub,q.afterOrdinal,q.limit),'Warsh bookmarks',req);
}));
warshRouter.put('/bookmarks',asyncHandler(async (req,res) => { sendSuccess(res,await setWarshBookmark(req.user!.sub,warshBookmarkInputSchema.parse(req.body)),'Warsh bookmark saved',req); }));
warshRouter.get('/cycles/current',asyncHandler(async (req,res) => { sendSuccess(res,await getWarshCycle(req.user!.sub),'Warsh Khatmah',req); }));
warshRouter.post('/cycles',asyncHandler(async (req,res) => { sendSuccess(res,await startWarshCycle(req.user!.sub,warshCycleInputSchema.parse(req.body)),'Warsh Khatmah started',req); }));
warshRouter.get('/cycles/:cycleId',asyncHandler(async (req,res) => { sendSuccess(res,await getWarshCycle(req.user!.sub,z.string().uuid().parse(req.params.cycleId)),'Warsh Khatmah',req); }));
warshRouter.get('/cycles/:cycleId/completions',asyncHandler(async (req,res) => {
  const q = z.object({ surah:z.coerce.number().int().min(1).max(114) }).strict().parse(req.query);
  sendSuccess(res,await getWarshCompletedVerses(req.user!.sub,z.string().uuid().parse(req.params.cycleId),q.surah),'Warsh confirmed verses',req);
}));
warshRouter.put('/cycles/:cycleId/completions',asyncHandler(async (req,res) => { sendSuccess(res,await setWarshCompletions(req.user!.sub,z.string().uuid().parse(req.params.cycleId),warshCompletionInputSchema.parse(req.body)),'Warsh reading confirmed',req); }));
