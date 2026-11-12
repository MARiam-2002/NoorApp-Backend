import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/common';
import { authenticate } from '../middleware/auth';
import { sendSuccess } from '../shared/utils/response';
import { getLocalClock, resolveTimezone } from '../services/salawat-reminder.service';
import {
  getRadioStations, getDailyPlaylist, listPlaylists, getPlaylist, createPlaylist, updatePlaylist, deletePlaylist,
} from '../services/quran-station.service';

/**
 * Quran station (Listen section): GET /quran/radio · GET /quran/playlists/daily (public)
 * GET|POST /quran/playlists · GET|PUT|DELETE /quran/playlists/:id (signed in).
 */
export const quranStationRouter = Router();
const privateCache: import('express').RequestHandler = (_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); };
const playlistId = z.string().uuid();

quranStationRouter.get('/radio', asyncHandler(async (req, res) => {
  const q = z.object({ category: z.string().max(30).optional() }).strict().parse(req.query);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  sendSuccess(res, getRadioStations(q.category), 'Radio stations', req);
}));

/** Same six surahs for everyone on a local date; `date` defaults to today in `timezone` (default Africa/Cairo). */
quranStationRouter.get('/playlists/daily', asyncHandler(async (req, res) => {
  const q = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), timezone: z.string().max(64).optional() }).strict().parse(req.query);
  const day = q.date ?? getLocalClock(new Date(), resolveTimezone(q.timezone)).dayKey;
  res.setHeader('Cache-Control', q.date ? 'public, max-age=86400' : 'public, max-age=900');
  sendSuccess(res, getDailyPlaylist(day), 'Daily playlist', req);
}));

quranStationRouter.get('/playlists', authenticate, privateCache, asyncHandler(async (req, res) => {
  sendSuccess(res, await listPlaylists(req.user!.sub), 'Playlists', req);
}));
quranStationRouter.post('/playlists', authenticate, privateCache, asyncHandler(async (req, res) => {
  sendSuccess(res, await createPlaylist(req.user!.sub, req.body), 'Playlist created', req, 201);
}));
quranStationRouter.get('/playlists/:id', authenticate, privateCache, asyncHandler(async (req, res) => {
  sendSuccess(res, await getPlaylist(req.user!.sub, playlistId.parse(req.params.id)), 'Playlist', req);
}));
quranStationRouter.put('/playlists/:id', authenticate, privateCache, asyncHandler(async (req, res) => {
  sendSuccess(res, await updatePlaylist(req.user!.sub, playlistId.parse(req.params.id), req.body), 'Playlist saved', req);
}));
quranStationRouter.delete('/playlists/:id', authenticate, privateCache, asyncHandler(async (req, res) => {
  sendSuccess(res, await deletePlaylist(req.user!.sub, playlistId.parse(req.params.id)), 'Playlist deleted', req);
}));
