import { Router } from 'express';

import { healthRouter } from './health';
import { authRouter } from './auth';
import { profileRouter } from './profile';
import { dashboardRouter } from './dashboard';
import { prayerRouter } from './prayers';
import { journeyRouter } from './journey';
import { quranRouter } from './quran';
import { challengesRouter } from './challenges';
import { contentRouter } from './content';
import { notificationsRouter } from './notifications';
import { tasbihRouter } from './tasbih';
import { qiblaRouter } from './qibla';
import { adhkarRouter } from './adhkar';
import { devicesRouter } from './devices';
import { cronRouter } from './cron';

export const v1Router = Router();

v1Router.use('/health', healthRouter);
v1Router.use('/auth', authRouter);
v1Router.use('/profile', profileRouter);
v1Router.use('/dashboard', dashboardRouter);
v1Router.use('/prayers', prayerRouter);
v1Router.use('/journey', journeyRouter);
v1Router.use('/quran', quranRouter);
v1Router.use('/challenges', challengesRouter);
v1Router.use('/content', contentRouter);
v1Router.use('/notifications', notificationsRouter);
v1Router.use('/tasbih', tasbihRouter);
v1Router.use('/qibla', qiblaRouter);
v1Router.use('/adhkar', adhkarRouter);
v1Router.use('/devices', devicesRouter);
v1Router.use('/cron', cronRouter);
