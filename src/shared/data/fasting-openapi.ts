import { z } from 'zod';
import {
  qadaAdjustmentSchema, qadaEstimateSchema, qadaFidyaSchema, qadaPreferencesPatchSchema,
} from '../../services/fasting-qada.service';
import { excuseEndSchema, excusePatchSchema, excuseStartSchema } from '../../services/prayer-excuse.service';

export function addFastingOpenApi(spec: any) {
  const jsonSchema = (schema: z.ZodType) => z.toJSONSchema(schema, { io: 'input', target: 'openapi-3.0', unrepresentable: 'any' });
  const schemas = (spec.components ??= {}).schemas ??= {};
  schemas.QadaPreferencesPatch = jsonSchema(qadaPreferencesPatchSchema);
  schemas.QadaAdjustmentInput = jsonSchema(qadaAdjustmentSchema);
  schemas.QadaFidyaInput = jsonSchema(qadaFidyaSchema);
  schemas.QadaEstimateInput = jsonSchema(qadaEstimateSchema);
  schemas.PrayerExcuseStartInput = jsonSchema(excuseStartSchema);
  schemas.PrayerExcuseEndInput = jsonSchema(excuseEndSchema);
  schemas.PrayerExcusePatch = jsonSchema(excusePatchSchema);
  const body = (name: string) => ({ requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/' + name } } } } });
  const responses = { '200': { description: 'Standard Noor success envelope. Qada calls return the full qada summary; excuse calls return the excuse state.' },
    '400': { description: 'Invalid input. details.reason: RAMADAN_NOT_STARTED, FUTURE_DAY, RAMADAN, EID_AL_FITR, EID_AL_ADHA, TASHREEQ, TOO_OLD' },
    '401': { description: 'Authentication required' }, '404': { description: 'Account or entry not found' },
    '409': { description: 'Stale expectedRevision, or excuse state conflict (ALREADY_ACTIVE, NOT_ACTIVE, OVERLAP)' } };
  const qada = (summary: string, extra: Record<string, unknown> = {}) => ({ tags: ['Fasting'], summary, security: [{ bearerAuth: [] }], responses,
    description: 'Private/no-store. The reason a fast was missed is never sent or stored. Balance per Ramadan year = missed + adjustments - fidya; made-up days pay the oldest year first. Hijri dates use Umm al-Qura plus the user hijriOffsetDays.', ...extra });
  const pathYearDay = { parameters: [{ in: 'path', name: 'hijriYear', required: true, schema: { type: 'integer', example: 1447 } }, { in: 'path', name: 'ramadanDay', required: true, schema: { type: 'integer', minimum: 1, maximum: 30 } }] };
  const pathDate = { parameters: [{ in: 'path', name: 'date', required: true, schema: { type: 'string', format: 'date', example: '2026-11-09' } }] };
  spec.paths['/fasting/qada'] = { get: qada('Qada summary: remaining days per Ramadan year, deadlines, pace, today/tomorrow, fidya, notes and sources'), delete: qada('Delete all qada data of this account') };
  spec.paths['/fasting/qada/events'] = { get: qada('Ledger history, newest first', { parameters: [{ in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100 } }, { in: 'query', name: 'before', schema: { type: 'string', format: 'date-time' } }] }) };
  spec.paths['/fasting/qada/ramadan-days/{hijriYear}/{ramadanDay}'] = { put: qada('Mark a Ramadan day as missed (idempotent)', pathYearDay), delete: qada('Unmark a missed Ramadan day', pathYearDay) };
  spec.paths['/fasting/qada/make-ups/{date}'] = { put: qada('Record a make-up fast on a local date (idempotent). Refused on Ramadan, Eid and Tashreeq days', pathDate), delete: qada('Remove a recorded make-up fast', pathDate) };
  spec.paths['/fasting/qada/adjustments'] = { post: qada('Add or subtract days for a Ramadan year (starting balance or correction)', body('QadaAdjustmentInput')) };
  spec.paths['/fasting/qada/fidya'] = { post: qada('Record days covered by fidya (for people who cannot fast)', body('QadaFidyaInput')) };
  spec.paths['/fasting/qada/estimate'] = { post: qada('"I do not remember": estimate days for a range of years; apply=true saves one adjustment per year', body('QadaEstimateInput')) };
  spec.paths['/fasting/qada/events/{id}'] = { delete: qada('Delete one ledger entry', { parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }] }) };
  spec.paths['/fasting/qada/preferences'] = { patch: qada('Reminder (evening before a planned fasting weekday), weekdays and Hijri offset', body('QadaPreferencesPatch')) };

  const excuse = (summary: string, extra: Record<string, unknown> = {}) => ({ tags: ['Prayers'], summary, security: [{ bearerAuth: [] }], responses,
    description: 'Excuse mode: private/no-store neutral pause of prayer tracking. No reason is stored. Excused days are shown as prayersExcused / excused in Journey and Home and leave the prayer percentage. An open period ends by itself after 40 days. muteReminders=true stops server Azan backup, pre-prayer, Duha and Qiyam pushes; Flutter must also pause its local prayer notifications.', ...extra });
  spec.paths['/prayers/excuse'] = { get: excuse('Current excuse state and recent periods') };
  spec.paths['/prayers/excuse/start'] = { post: excuse('Turn excuse mode on (startDate up to 15 days back)', body('PrayerExcuseStartInput')) };
  spec.paths['/prayers/excuse/end'] = { post: excuse('Turn excuse mode off; endDate = last excused day (default today)', body('PrayerExcuseEndInput')) };
  spec.paths['/prayers/excuse/current'] = { patch: excuse('Change muteReminders of the open period', body('PrayerExcusePatch')) };
  spec.paths['/prayers/excuse/periods/{id}'] = { delete: excuse('Delete a period entered by mistake', { parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }] }) };
}
