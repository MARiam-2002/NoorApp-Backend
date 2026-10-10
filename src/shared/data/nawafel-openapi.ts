import { NAWAFEL_KEYS } from '../constants/nawafel';
export function addNawafelOpenApi(spec: any): void {
  const schemas = spec.components.schemas;
  const prefs = { type: 'object', additionalProperties: false, properties: { showOnHome: { type: 'boolean', default: true }, selectedKeys: { type: 'array', uniqueItems: true, maxItems: 5, items: { type: 'string', enum: [...NAWAFEL_KEYS] }, description: 'Empty selection is allowed and produces NONE_SELECTED, never 100% completion.' } } };
  schemas.NawafelPreferences = { ...prefs, required: ['showOnHome', 'selectedKeys'] };
  schemas.NawafelPreferencesPatch = { ...prefs, minProperties: 1 };
  schemas.NawafelCompletionInput = { type: 'object', additionalProperties: false, required: ['completed','date'], properties: { completed: { type: 'boolean' }, date: { type: 'string', format: 'date', description: 'Use date from GET /nawafel/today. Only current local day may be modified; stale day returns 409.' } } };
  schemas.NawafelTracking = { type: 'object', properties: { state: { type: 'string', enum: ['ACTIVE','NONE_SELECTED'] }, completedSlots: { type: 'integer' }, totalSlots: { type: 'integer' }, completedRakahs: { type: 'integer' }, totalRakahs: { type: 'integer' }, progress: { type: 'number', minimum: 0, maximum: 1 } } };
  schemas.NawafelToday = { type: 'object', properties: {
    date: { type: 'string', format: 'date' }, timezone: { type: 'string' },
    preferences: { $ref: '#/components/schemas/NawafelPreferences' }, tracking: { $ref: '#/components/schemas/NawafelTracking' },
    items: { type: 'array', items: { type: 'object', properties: { key: { type: 'string', enum: [...NAWAFEL_KEYS] }, selected: { type: 'boolean' }, completed: { type: 'boolean' }, rakahs: { type: 'integer' }, titleAr: { type: 'string' }, titleEn: { type: 'string' } } } },
    completedSlots: { type: 'integer' }, totalSlots: { type: 'integer', enum: [5] }, completedRakahs: { type: 'integer' }, totalRakahs: { type: 'integer', enum: [12] }, progress: { type: 'number', minimum: 0, maximum: 1 },
  } };
  schemas.NawafelCompletionResult = { type: 'object', properties: { key: { type: 'string', enum: [...NAWAFEL_KEYS] }, completed: { type: 'boolean' }, today: { $ref: '#/components/schemas/NawafelToday' } } };
  const responses = { '200': { description: 'Standard success envelope. Private, no-store.' }, '400': { description: 'Invalid selection, body, date or unselected sunnah slot' }, '401': { description: 'Authentication required' }, '409': { description: 'Local calendar day changed; refresh before confirming' } };
  const body = (name: string) => ({ required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/' + name } } } });
  spec.paths['/profile/nawafel-preferences'] = {
    get: { tags: ['Nawafel'], summary: 'Private synced home visibility and selected sunnah slots', security: [{ bearerAuth: [] }], responses },
    patch: { tags: ['Nawafel'], summary: 'Update visibility/selection; preserves daily completion history', security: [{ bearerAuth: [] }], requestBody: body('NawafelPreferencesPatch'), responses },
  };
  spec.paths['/nawafel/{key}/completion'] = { put: { tags: ['Nawafel'], summary: 'Set explicit daily completion state; identical retries never toggle it', security: [{ bearerAuth: [] }],
    parameters: [{ in: 'path', name: 'key', required: true, schema: { type: 'string', enum: [...NAWAFEL_KEYS] } }], requestBody: body('NawafelCompletionInput'), responses } };
  const success = (name: string) => ({ description: 'Standard success envelope. Private, no-store.', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: { $ref: '#/components/schemas/' + name } } } } } });
  spec.paths['/profile/nawafel-preferences'].get.responses = { ...responses, '200': success('NawafelPreferences') };
  spec.paths['/profile/nawafel-preferences'].patch.responses = { ...responses, '200': success('NawafelPreferences') };
  spec.paths['/nawafel/{key}/completion'].put.responses = { ...responses, '200': success('NawafelCompletionResult') };
  if (spec.paths['/nawafel/today']?.get) spec.paths['/nawafel/today'].get.responses = { ...responses, '200': success('NawafelToday') };
  if (spec.paths['/nawafel/{key}/mark']?.patch) {
    spec.paths['/nawafel/{key}/mark'].patch.deprecated = true;
    spec.paths['/nawafel/{key}/mark'].patch.description = 'Legacy toggle for existing clients. Not safe for automatic retry. New clients must use PUT /nawafel/{key}/completion with completed and date.';
  }
  if (spec.paths['/nawafel/today']?.get) spec.paths['/nawafel/today'].get.description = 'All five catalog slots with completed and selected states. Legacy root totals describe all 12 rakahs; use tracking for selected-only progress and preferences.showOnHome for visibility. Nawaﬁl do not change the obligatory-prayer denominator.';
}
