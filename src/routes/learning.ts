import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate, optionalAuthenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import { getLearningCollection, getLearningHub, getLearningItem, saveLearningProgress } from '../services/learning.service';
import { z } from 'zod';
import { getFiqhCourse, getFiqhCourseAll, getFiqhCourseCards, getFiqhGlossary, getFiqhLesson, saveFiqhProgress } from '../services/fiqh-course.service';

/** Learning hub. Content is public; progress is private. See FLUTTER_LEARNING_HUB_HANDOFF_2026-11-05.md. */
export const learningRouter = Router();
const cache = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', req.user ? 'private, no-store' : 'public, max-age=600');
  next();
};

learningRouter.get('/', optionalAuthenticate, cache, asyncHandler(async (req, res) => {
  const [hub, courses] = await Promise.all([getLearningHub(req.user?.sub), getFiqhCourseCards(req.user?.sub)]);
  sendSuccess(res, { ...hub, courses }, 'Learning hub', req);
}));

/** Courses (الفقه الميسر): content public, progress private. */
const lessonParam = z.coerce.number().int().min(1).max(100000);
learningRouter.get('/courses', optionalAuthenticate, cache, asyncHandler(async (req, res) => {
  sendSuccess(res, await getFiqhCourseCards(req.user?.sub), 'Learning courses', req);
}));
learningRouter.get('/courses/:courseId', optionalAuthenticate, cache, asyncHandler(async (req, res) => {
  sendSuccess(res, await getFiqhCourse(String(req.params.courseId), req.user?.sub), 'Course', req);
}));
learningRouter.get('/courses/:courseId/all', asyncHandler(async (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  sendSuccess(res, getFiqhCourseAll(String(req.params.courseId)), 'Course content', req);
}));
learningRouter.get('/courses/:courseId/glossary', asyncHandler(async (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  sendSuccess(res, getFiqhGlossary(String(req.params.courseId)), 'Course glossary', req);
}));
learningRouter.get('/courses/:courseId/lessons/:lessonId', optionalAuthenticate, cache, asyncHandler(async (req, res) => {
  sendSuccess(res, await getFiqhLesson(String(req.params.courseId), lessonParam.parse(req.params.lessonId), req.user?.sub), 'Course lesson', req);
}));
learningRouter.put('/courses/:courseId/lessons/:lessonId/progress', authenticate, asyncHandler(async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  sendSuccess(res, await saveFiqhProgress(req.user!.sub, String(req.params.courseId), lessonParam.parse(req.params.lessonId), req.body), 'Progress saved', req);
}));
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
