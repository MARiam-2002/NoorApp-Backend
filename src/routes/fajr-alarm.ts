import { Router } from 'express';
import { statSync } from 'node:fs';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import { fajrAlarmScheduleQuerySchema, getFajrAlarmSchedule } from '../services/fajr-alarm.service';
import { getFajrAlarmSounds, resolveFajrAlarmAudioFile } from '../services/fajr-alarm-audio.service';
import { AppError } from '../lib/errors';
import { ErrorCodes } from '../config';
export const fajrAlarmRouter = Router();
// Public preview/download. The personal schedule below remains authenticated.
fajrAlarmRouter.get('/sounds', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  sendSuccess(res, getFajrAlarmSounds(req), 'Fajr alarm sounds', req);
});
fajrAlarmRouter.get('/media/:file', (req, res, next) => {
  const file = resolveFajrAlarmAudioFile(String(req.params.file));
  if (!file) return next(new AppError('Alarm sound not found', 404, ErrorCodes.NOT_FOUND));
  res.type('audio/mpeg');
  res.sendFile(file, { acceptRanges: true, maxAge: 31536000000, immutable: true }, err => {
    if (!err) return;
    if (!res.headersSent && (err as any).status === 416) {
      res.status(416).setHeader('Content-Range', `bytes */${statSync(file).size}`).end();
      return;
    }
    if (res.headersSent) { res.destroy(err); return; }
    next(err);
  });
});
fajrAlarmRouter.use(authenticate);
fajrAlarmRouter.use((_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); });
fajrAlarmRouter.get('/schedule', asyncHandler(async (req, res) => {
  const { days } = fajrAlarmScheduleQuerySchema.parse(req.query);
  sendSuccess(res, await getFajrAlarmSchedule(req.user!.sub, days), 'Fajr alarm schedule', req);
}));
