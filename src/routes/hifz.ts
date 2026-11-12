import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import {
  addHifzSegment, deleteHifzPlan, deleteHifzSegment, getHifzPlan, getHifzProgress, getHifzTest, getHifzToday,
  hifzPlanInputSchema, hifzReviewInputSchema, hifzSegmentInputSchema, reviewHifzSegment, saveHifzPlan, setHifzPlanStatus,
  HIFZ_REVIEW_INTERVALS,
} from '../services/hifz.service';

/**
 * Quran memorization. All routes are private to the signed-in user.
 * GET /hifz/plan · PUT /hifz/plan · PATCH /hifz/plan/status · DELETE /hifz/plan?deleteProgress=true
 * GET /hifz/today · GET /hifz/progress · POST /hifz/segments · DELETE /hifz/segments/:id
 * POST /hifz/segments/:id/review · GET /hifz/test
 */
export const hifzRouter = Router();
const privateCache: RequestHandler = (_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); };
hifzRouter.use(authenticate, privateCache);
const segmentId = z.string().uuid();

hifzRouter.get('/plan', asyncHandler(async (req, res) => {
  sendSuccess(res, { ...(await getHifzPlan(req.user!.sub)), reviewIntervalsDays: HIFZ_REVIEW_INTERVALS }, 'Memorization plan', req);
}));
hifzRouter.put('/plan', asyncHandler(async (req, res) => {
  sendSuccess(res, await saveHifzPlan(req.user!.sub, hifzPlanInputSchema.parse(req.body)), 'Memorization plan saved', req);
}));
hifzRouter.patch('/plan/status', asyncHandler(async (req, res) => {
  const { status } = z.object({ status: z.enum(['ACTIVE', 'PAUSED']) }).strict().parse(req.body);
  sendSuccess(res, await setHifzPlanStatus(req.user!.sub, status), 'Memorization plan updated', req);
}));
hifzRouter.delete('/plan', asyncHandler(async (req, res) => {
  const { deleteProgress } = z.object({ deleteProgress: z.enum(['true', 'false']).default('false') }).strict().parse(req.query);
  sendSuccess(res, await deleteHifzPlan(req.user!.sub, deleteProgress === 'true'), 'Memorization plan deleted', req);
}));
hifzRouter.get('/today', asyncHandler(async (req, res) => { sendSuccess(res, await getHifzToday(req.user!.sub), 'Memorization today', req); }));
hifzRouter.get('/progress', asyncHandler(async (req, res) => { sendSuccess(res, await getHifzProgress(req.user!.sub), 'Memorization progress', req); }));
hifzRouter.post('/segments', asyncHandler(async (req, res) => {
  sendSuccess(res, await addHifzSegment(req.user!.sub, hifzSegmentInputSchema.parse(req.body)), 'Marked as memorized', req, 201);
}));
hifzRouter.delete('/segments/:id', asyncHandler(async (req, res) => {
  sendSuccess(res, await deleteHifzSegment(req.user!.sub, segmentId.parse(req.params.id)), 'Segment removed', req);
}));
hifzRouter.post('/segments/:id/review', asyncHandler(async (req, res) => {
  const { grade } = hifzReviewInputSchema.parse(req.body);
  sendSuccess(res, await reviewHifzSegment(req.user!.sub, segmentId.parse(req.params.id), grade), 'Review saved', req);
}));
hifzRouter.get('/test', asyncHandler(async (req, res) => { sendSuccess(res, await getHifzTest(req.user!.sub, req.query), 'Memorization test', req); }));
