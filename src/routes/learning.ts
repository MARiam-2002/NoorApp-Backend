import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate, optionalAuthenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import { getLearningCollection, getLearningHub, getLearningItem, saveLearningProgress } from '../services/learning.service';

/** Learning hub. Content is public; progress is private. See FLUTTER_LEARNING_HUB_HANDOFF_2026-11-05.md. */
export const learningRouter = Router();
const cache = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', req.user ? 'private, no-store' : 'public, max-age=600');
  next();
};

learningRouter.get('/', optionalAuthenticate, cache, asyncHandler(async (req, res) => { sendSuccess(res, await getLearningHub(req.user?.sub), 'Learning hub', req); }));
learningRouter.get('/collections/:id', optionalAuthenticate, cache, asyncHandler(async (req, res) => {
  sendSuccess(res, await getLearningCollection(String(req.params.id), req.user?.sub), 'Learning section', req);
}));
learningRouter.get('/items/:id', optionalAuthenticate, cache, asyncHandler(async (req, res) => {
  sendSuccess(res, await getLearningItem(String(req.params.id), req.user?.sub), 'Learning item', req);
}));
learningRouter.put('/items/:id/progress', authenticate, asyncHandler(async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  sendSuccess(res, await saveLearningProgress(req.user!.sub, String(req.params.id), req.body), 'Progress saved', req);
}));
