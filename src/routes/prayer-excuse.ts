import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import { deletePrayerExcusePeriod, endPrayerExcuse, getPrayerExcuse, startPrayerExcuse, updatePrayerExcuse } from '../services/prayer-excuse.service';

/** Excuse mode: neutral pause of prayer tracking. Mounted at /prayers/excuse (before /prayers). */
export const prayerExcuseRouter = Router();
prayerExcuseRouter.use(authenticate);
prayerExcuseRouter.use((_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); });

prayerExcuseRouter.get('/', asyncHandler(async (req, res) => { sendSuccess(res, await getPrayerExcuse(req.user!.sub), 'Excuse mode', req); }));
prayerExcuseRouter.post('/start', asyncHandler(async (req, res) => { sendSuccess(res, await startPrayerExcuse(req.user!.sub, req.body), 'Excuse mode on', req); }));
prayerExcuseRouter.post('/end', asyncHandler(async (req, res) => { sendSuccess(res, await endPrayerExcuse(req.user!.sub, req.body), 'Excuse mode off', req); }));
prayerExcuseRouter.patch('/current', asyncHandler(async (req, res) => { sendSuccess(res, await updatePrayerExcuse(req.user!.sub, req.body), 'Excuse mode updated', req); }));
prayerExcuseRouter.delete('/periods/:id', asyncHandler(async (req, res) => { sendSuccess(res, await deletePrayerExcusePeriod(req.user!.sub, String(req.params.id)), 'Period removed', req); }));
