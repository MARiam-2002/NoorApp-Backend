import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import { continuityMonthSchema } from '../services/continuity-core';
import { completeContinuityAdhkar, continuityAdhkarCategorySchema, getContinuityAdhkarTarget, getContinuityCalendar,
  getContinuityOfflineContext, getContinuityShare, getContinuitySummary, updateContinuityPreferences } from '../services/continuity.service';

export const continuityRouter = Router();
continuityRouter.use((_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); });
continuityRouter.use(authenticate);
continuityRouter.get('/', asyncHandler(async (req, res) => { sendSuccess(res, await getContinuitySummary(req.user!.sub), 'Your consistency with Noor', req); }));
continuityRouter.get('/calendar', asyncHandler(async (req, res) => {
  const query = continuityMonthSchema.parse(req.query);
  sendSuccess(res, await getContinuityCalendar(req.user!.sub, query.month), 'Continuity calendar', req);
}));
continuityRouter.get('/offline-context', asyncHandler(async (req, res) => { sendSuccess(res, await getContinuityOfflineContext(req.user!.sub), 'Offline completion context', req); }));
continuityRouter.get('/adhkar-target', asyncHandler(async (req, res) => {
  const query = z.object({ category: continuityAdhkarCategorySchema }).strict().parse(req.query);
  sendSuccess(res, await getContinuityAdhkarTarget(req.user!.sub, query.category), 'Complete Adhkar target', req);
}));
continuityRouter.post('/adhkar-completions', asyncHandler(async (req, res) => { sendSuccess(res, await completeContinuityAdhkar(req.user!.sub, req.body), 'Adhkar portion confirmed', req); }));
continuityRouter.patch('/preferences', asyncHandler(async (req, res) => { sendSuccess(res, await updateContinuityPreferences(req.user!.sub, req.body), 'Continuity preferences saved', req); }));
continuityRouter.get('/share', asyncHandler(async (req, res) => { sendSuccess(res, await getContinuityShare(req.user!.sub), 'Optional continuity share content', req); }));
