import { Router } from 'express';
import {
  listSalawatAudioHandler,
  streamSalawatMediaHandler,
} from '../controllers/salawat.controller';

/**
 * Public Salawat / Prayer Upon the Prophet ﷺ audio catalog.
 * Preference sync remains GET/PATCH/PUT /profile/salawat-preferences.
 */
export const salawatRouter = Router();

salawatRouter.get('/audio', listSalawatAudioHandler);
salawatRouter.get('/media/:file', streamSalawatMediaHandler);
