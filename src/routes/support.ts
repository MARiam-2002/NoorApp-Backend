import { Router } from 'express';
import { sendSuccess } from '../shared/utils/response';
import { getSupportInfo } from '../services/support.service';

export const supportRouter = Router();
/**
 * @openapi
 * /support:
 *   get:
 *     tags: ['Support']
 *     summary: Public Noor support contacts and bilingual frequently asked questions
 *     description: No sign-in required. Returns schemaVersion, WhatsApp and email links, response message, businessHours=null and FAQs. Opens an external contact only; does not send or store a message.
 *     responses:
 *       200:
 *         description: Standard success envelope with public support configuration
 */
supportRouter.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  sendSuccess(res, getSupportInfo(), 'Support information retrieved successfully', req);
});
