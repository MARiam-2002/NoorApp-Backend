import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import {
  addQadaAdjustment, addQadaFidya, deleteQadaEvent, estimateQada, getQadaSummary, listQadaEvents, markMadeUpDay,
  markRamadanDayMissed, parseMadeUpDate, parseRamadanDayParams, resetQada, unmarkMadeUpDay, unmarkRamadanDayMissed,
  updateQadaPreferences,
} from '../services/fasting-qada.service';

/** Fasting qada ledger. Private per user; responses are never cached. See FLUTTER_FASTING_QADA_AND_EXCUSE_MODE_HANDOFF_2026-11-05.md. */
export const fastingRouter = Router();
fastingRouter.use(authenticate);
fastingRouter.use((_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); });

fastingRouter.get('/qada', asyncHandler(async (req, res) => { sendSuccess(res, await getQadaSummary(req.user!.sub), 'Qada summary', req); }));
fastingRouter.delete('/qada', asyncHandler(async (req, res) => { sendSuccess(res, await resetQada(req.user!.sub), 'Qada data deleted', req); }));
fastingRouter.get('/qada/events', asyncHandler(async (req, res) => { sendSuccess(res, await listQadaEvents(req.user!.sub, req.query), 'Qada history', req); }));
fastingRouter.put('/qada/ramadan-days/:hijriYear/:ramadanDay', asyncHandler(async (req, res) => {
  const p = parseRamadanDayParams(String(req.params.hijriYear), String(req.params.ramadanDay));
  sendSuccess(res, await markRamadanDayMissed(req.user!.sub, p.hijriYear, p.ramadanDay), 'Ramadan day marked as missed', req);
}));
fastingRouter.delete('/qada/ramadan-days/:hijriYear/:ramadanDay', asyncHandler(async (req, res) => {
  const p = parseRamadanDayParams(String(req.params.hijriYear), String(req.params.ramadanDay));
  sendSuccess(res, await unmarkRamadanDayMissed(req.user!.sub, p.hijriYear, p.ramadanDay), 'Ramadan day unmarked', req);
}));
fastingRouter.put('/qada/make-ups/:date', asyncHandler(async (req, res) => {
  sendSuccess(res, await markMadeUpDay(req.user!.sub, parseMadeUpDate(String(req.params.date))), 'Make-up fast recorded', req);
}));
fastingRouter.delete('/qada/make-ups/:date', asyncHandler(async (req, res) => {
  sendSuccess(res, await unmarkMadeUpDay(req.user!.sub, parseMadeUpDate(String(req.params.date))), 'Make-up fast removed', req);
}));
fastingRouter.post('/qada/adjustments', asyncHandler(async (req, res) => { sendSuccess(res, await addQadaAdjustment(req.user!.sub, req.body), 'Qada balance adjusted', req); }));
fastingRouter.post('/qada/fidya', asyncHandler(async (req, res) => { sendSuccess(res, await addQadaFidya(req.user!.sub, req.body), 'Fidya recorded', req); }));
fastingRouter.post('/qada/estimate', asyncHandler(async (req, res) => { sendSuccess(res, await estimateQada(req.user!.sub, req.body), 'Qada estimate', req); }));
fastingRouter.delete('/qada/events/:id', asyncHandler(async (req, res) => { sendSuccess(res, await deleteQadaEvent(req.user!.sub, String(req.params.id)), 'Entry removed', req); }));
fastingRouter.patch('/qada/preferences', asyncHandler(async (req, res) => { sendSuccess(res, await updateQadaPreferences(req.user!.sub, req.body), 'Qada settings saved', req); }));
