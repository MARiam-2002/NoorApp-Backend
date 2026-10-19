import { z } from 'zod';
import { continuityPreferencePatchSchema, offlineCompletionSchema } from '../../services/continuity-core';
import { continuityAdhkarCompletionSchema } from '../../services/continuity.service';

export function addContinuityOpenApi(spec: any) {
  const jsonSchema = (schema: z.ZodType) => z.toJSONSchema(schema, { io: 'input', target: 'openapi-3.0', unrepresentable: 'any' });
  const schemas = (spec.components ??= {}).schemas ??= {};
  schemas.ContinuityOfflineReceipt = jsonSchema(offlineCompletionSchema);
  schemas.ContinuityPreferencePatch = jsonSchema(continuityPreferencePatchSchema);
  schemas.ContinuityAdhkarCompletion = jsonSchema(continuityAdhkarCompletionSchema);
  const op = (summary: string, body?: string) => ({ tags: ['Continuity'], summary,
    description: 'Private/no-store. One completed day per account. No grace days, purchased recovery, points or leaderboard. Uses the immutable continuity timezone shown in the response. No app-open credit.',
    security: [{ bearerAuth: [] }],
    ...(body ? { requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/' + body } } } } } : {}),
    responses: { '200': { description: 'Standard Noor success envelope' }, '400': { description: 'Invalid fields or incomplete Adhkar target' }, '401': { description: 'Authentication required' },
      '404': { description: 'Account not found' }, '409': { description: 'Stale revision/target, request-key conflict or expired/invalid offline context' } },
  });
  spec.paths['/continuity'] = { get: op('Current and best consistency streak, total days, milestones and server day boundary') };
  spec.paths['/continuity/calendar'] = { get: { ...op('One bounded calendar month of completed days'), parameters: [{ in: 'query', name: 'month', schema: { type: 'string', pattern: '^\\d{4}-(0[1-9]|1[0-2])$' } }] } };
  spec.paths['/continuity/offline-context'] = { get: op('Issue a seven-day account/timezone-bound signed offline context') };
  spec.paths['/continuity/preferences'] = { patch: op('Update opt-in reminder settings with expectedRevision', 'ContinuityPreferencePatch') };
  spec.paths['/continuity/adhkar-target'] = { get: { ...op('Required items and exact targetVersion for one complete Adhkar portion'), parameters: [{ in: 'query', name: 'category', required: true, schema: { type: 'string', enum: ['MORNING', 'EVENING', 'GENERAL_WIRD'] } }] } };
  spec.paths['/continuity/adhkar-completions'] = { post: op('Confirm the complete offered Adhkar portion once, online or within a signed offline window', 'ContinuityAdhkarCompletion') };
  spec.paths['/continuity/share'] = { get: op('Private text/data for an optional Flutter-rendered share card without worship details') };
  // Additive fields only: existing required properties and endpoint paths remain intact.
  for (const name of ['ReadingConfirmationInput', 'ReadingSessionUpdateInput']) {
    if (schemas[name]?.properties) schemas[name].properties.continuity = { $ref: '#/components/schemas/ContinuityOfflineReceipt' };
  }
  for (const name of ['DashboardResponse', 'JourneyTodayResponse']) {
    if (schemas[name]?.properties) schemas[name].properties.continuity = { type: 'object', description: 'Canonical new continuity summary; available=false on a feature-only outage. Legacy streak fields remain unchanged.' };
  }
}
