import { z } from 'zod';
import { adhkarReminderPatchSchema } from '../../services/adhkar-reminder.service';
export function addAdhkarReminderOpenApi(spec: any) {
  const op = (summary: string) => ({ tags: ['Profile'], summary, security: [{ bearerAuth: [] }],
    description: 'Opt-in morning/evening/bedtime reminders at saved local HH:mm. Defaults OFF, 07:00, 17:00 and 22:00, silent. Current profile timezone. Server-only delivery; do not add a local duplicate. Complete matching category suppresses delivery. One claim per account/local day/category, including time edits, DST repeats and retries. Bedtime Adhkar is separate from the existing Surah Al-Mulk reminder. Private/no-store.',
    responses: { '200': { description: 'Noor success envelope; data includes morningEnabled, morningTime, eveningEnabled, eveningTime, bedtimeEnabled, bedtimeTime, soundEnabled, revision, timezone, deliveryMode, skipWhenCompleted, timezonePolicy and updatedAt.' },
      '400': { description: 'Invalid HH:mm, unknown fields, empty patch or invalid revision' }, '401': { description: 'Authentication required' }, '409': { description: 'Stale expectedRevision: GET and reconcile before retrying' } },
  });
  spec.paths['/profile/adhkar-reminder-preferences'] = {
    get: op('Get morning, evening and bedtime Adhkar reminder settings'),
    patch: { ...op('Save Adhkar reminder settings with conflict protection'), requestBody: { required: true, content: {
      'application/json': { schema: z.toJSONSchema(adhkarReminderPatchSchema, { io: 'input', target: 'openapi-3.0', unrepresentable: 'any' }),
        example: { expectedRevision: 0, morningEnabled: true, morningTime: '07:00', eveningEnabled: true, eveningTime: '17:00' } },
    } } },
  };
}
