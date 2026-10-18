import { z } from 'zod';
import { fajrAlarmPatchPreferencesSchema } from '../../services/fajr-alarm.service';

export function addFajrAlarmOpenApi(spec: any) {
  spec.paths['/fajr-alarm/sounds'] = { get: { tags: ['Fajr alarm'], summary: 'Public wake-up sound catalog with download URLs and SHA-256', security: [], responses: { '200': { description: 'Noor envelope; download and validate custom audio before arming. System default needs no file.' } } } };
  spec.paths['/fajr-alarm/media/{file}'] = { get: { tags: ['Fajr alarm'], summary: 'Download or preview the self-hosted Fajr wake-up MP3', security: [],
    parameters: [{ in: 'path', name: 'file', required: true, schema: { type: 'string', enum: ['fajr_wakeup_alarm_v1.mp3'] } }],
    responses: { '200': { description: 'MP3 audio', content: { 'audio/mpeg': { schema: { type: 'string', format: 'binary' } } } }, '206': { description: 'Requested audio byte range' }, '404': { description: 'Unknown or missing asset' }, '416': { description: 'Unsatisfiable byte range' } } } };
  const preferences = z.toJSONSchema(fajrAlarmPatchPreferencesSchema, { io: 'input', unrepresentable: 'any', target: 'openapi-3.0' });
  const responses = {
    '200': { description: 'Noor success envelope. data contains settings/revision/policy, or the local-device UTC schedule.' },
    '400': { description: 'Invalid fields or query' },
    '401': { description: 'Authentication required' },
    '409': { description: 'Stale expectedRevision: GET settings, reconcile and retry' },
  };
  const common = { tags: ['Fajr alarm'], security: [{ bearerAuth: [] }], responses };
  spec.paths['/profile/fajr-alarm-preferences'] = {
    get: { ...common, summary: 'Get optional Fajr wake-up alarm settings', description: 'Default disabled. Private/no-store. Cloud enabled is intent; every device needs explicit local activation. Separate from Adhan.' },
    patch: { ...common, summary: 'Save Fajr alarm settings with optimistic concurrency',
      requestBody: { required: true, content: { 'application/json': { schema: {
        type: 'object', additionalProperties: false, required: ['expectedRevision', 'preferences'], properties: {
          expectedRevision: { type: 'integer', minimum: 0, maximum: 2147483646 },
          preferences: { ...preferences, required: [], minProperties: 1 },
        },
      }, example: { expectedRevision: 0, preferences: { enabled: true, beforeFajrMinutes: 10 } } } } },
    },
  };
  spec.paths['/fajr-alarm/schedule'] = { get: { ...common, summary: 'Get future Fajr wake-up occurrences for native scheduling',
    description: 'Calendar window starts today in resolved location timezone. ISO weekdays refer to Fajr day. UTC one-shots; no catch-up. Status DISABLED/LOCATION_REQUIRED/READY/PARTIAL. No fabricated polar Fajr. Not an FCM alarm. Stable occurrenceKey; replace pending native records when scheduleKey changes.',
    parameters: [{ in: 'query', name: 'days', schema: { type: 'integer', minimum: 1, maximum: 14, default: 7 } }],
  } };
}
