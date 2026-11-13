import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import { getSakinaAll, getSakinaMood, getSakinaMoods } from '../services/sakina.service';

/**
 * «سكينة» — public, no sign-in, nothing stored.
 * GET /sakina            feelings (chips)
 * GET /sakina/all        every feeling with its content (offline cache; refresh when `version` changes)
 * GET /sakina/:moodId    one feeling: ayat keys, adhkar from the catalog, verified hadith
 */
export const sakinaRouter = Router();
const cache = (res: any) => res.setHeader('Cache-Control', 'public, max-age=3600');
const noQuery = z.object({}).strict();

sakinaRouter.get('/', asyncHandler(async (req, res) => {
  noQuery.parse(req.query); cache(res); sendSuccess(res, getSakinaMoods(), 'Sakina feelings', req);
}));
sakinaRouter.get('/all', asyncHandler(async (req, res) => {
  noQuery.parse(req.query); cache(res); sendSuccess(res, getSakinaAll(), 'Sakina content', req);
}));
sakinaRouter.get('/:moodId', asyncHandler(async (req, res) => {
  const { moodId } = z.object({ moodId: z.string().regex(/^[a-z]{2,20}$/) }).parse(req.params);
  noQuery.parse(req.query); cache(res); sendSuccess(res, getSakinaMood(moodId), 'Sakina feeling', req);
}));
