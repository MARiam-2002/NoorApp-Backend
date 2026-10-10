import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import { editionIdSchema, getMushafEditions, getMushafPage, getMushafReaderState, readerStateSchema, setMushafReaderState, getMushafPreference, setMushafPreference, getMushafBookmarks, setMushafBookmark, mushafBookmarkSchema } from '../services/mushaf.service';
export const mushafRouter = Router();
mushafRouter.get('/editions', asyncHandler(async (req, res) => { res.setHeader('Cache-Control', 'public, max-age=60'); sendSuccess(res, { defaultEditionId: 'madani-hafs', editions: getMushafEditions() }, 'Mushaf editions', req); }));
mushafRouter.get('/editions/:editionId/pages/:page', asyncHandler(async (req, res) => {
  const id = editionIdSchema.parse(req.params.editionId); const page = z.coerce.number().int().positive().parse(req.params.page);
  const data = await getMushafPage(id, page); res.setHeader('Cache-Control', 'public, max-age=60'); sendSuccess(res, data, 'Edition page', req);
}));
const privateCache: import('express').RequestHandler = (_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); };
mushafRouter.get('/edition-preference', authenticate, privateCache, asyncHandler(async (req, res) => { sendSuccess(res, await getMushafPreference(req.user!.sub), 'Edition preference', req); }));
mushafRouter.put('/edition-preference', authenticate, privateCache, asyncHandler(async (req, res) => { const input = z.object({ editionId: editionIdSchema }).strict().parse(req.body); sendSuccess(res, await setMushafPreference(req.user!.sub, input.editionId), 'Edition selected', req); }));
mushafRouter.get('/editions/:editionId/bookmarks', authenticate, privateCache, asyncHandler(async (req, res) => { sendSuccess(res, await getMushafBookmarks(req.user!.sub, editionIdSchema.parse(req.params.editionId)), 'Edition bookmarks', req); }));
mushafRouter.put('/editions/:editionId/bookmarks', authenticate, privateCache, asyncHandler(async (req, res) => { sendSuccess(res, await setMushafBookmark(req.user!.sub, editionIdSchema.parse(req.params.editionId), mushafBookmarkSchema.parse(req.body)), 'Bookmark state saved', req); }));
mushafRouter.get('/editions/:editionId/reader-state', authenticate, privateCache, asyncHandler(async (req, res) => { sendSuccess(res, await getMushafReaderState(req.user!.sub, editionIdSchema.parse(req.params.editionId)), 'Reading position', req); }));
mushafRouter.put('/editions/:editionId/reader-state', authenticate, privateCache, asyncHandler(async (req, res) => { sendSuccess(res, await setMushafReaderState(req.user!.sub, editionIdSchema.parse(req.params.editionId), readerStateSchema.parse(req.body)), 'Reading position saved', req); }));
