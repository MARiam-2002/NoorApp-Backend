export function addZakatOpenApi(spec: any): void {
  const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
  const amount = { type: 'string', pattern: '^(0|[1-9][0-9]{0,14})(\\.[0-9]{1,6})?$', example: '100000.00' };
  const date = { type: 'string', format: 'date', example: '2026-10-10' };
  const key = { type: 'string', format: 'uuid', description: 'Generate once per user action. Retry with the same key/body; changed body returns 409.' };
  const currency = { type: 'string', pattern: '^[A-Z]{3}$', example: 'EGP', description: 'Supported ISO currency. All assets, price and liabilities must be in this one currency; no FX conversion.' };
  const body = (name: string) => ({ required: true, content: { 'application/json': { schema: ref(name) } } });
  const schemas = spec.components.schemas;
  schemas.ZakatCalculationInput = { type: 'object', additionalProperties: false,
    required: ['currency','asOfDate','nisabBasis','pricePerGram','priceAsOfDate','priceSource','quoteToken','hawlCompleted','assets'],
    properties: { currency, asOfDate: date, nisabBasis: { type: 'string', enum: ['GOLD_24K_85G','EGYPT_GOLD_21K_85G','SILVER_999_595G'] },
      quoteToken: { type: 'string', maxLength: 4096, description: 'Required by default. Copy from GET /zakat/metal-prices. Server verifies signature, price, currency, basis and expiry.' },
      pricePerGram: { ...amount, description: 'Copy the server quote exactly; never editable in Flutter.' }, priceAsOfDate: date,
      priceSource: { type: 'string', minLength: 2, maxLength: 160, example: 'Metals.dev international spot benchmark' }, hawlCompleted: { type: 'boolean', description: 'User confirmation of completed lunar hawl under their scholarly guidance; never inferred from salary/monthly savings.' },
      assets: { type: 'object', additionalProperties: false, properties: Object.fromEntries(['cash','bankBalances','zakatableGoldValue','zakatableSilverValue','tradeInventory','zakatableInvestments','collectibleReceivables'].map(name => [name, { ...amount, default: '0' }])) },
      deductibleLiabilities: { ...amount, default: '0' }, deductionsConfirmed: { type: 'boolean', default: false, description: 'Required true if deductions are positive. Deduct only eligible liabilities per the selected guidance.' } } };
  schemas.ZakatAssessment = { type: 'object', properties: { currency, minorUnitDigits: { type: 'integer' }, asOfDate: date,
    status: { type: 'string', enum: ['QUOTE_STALE','BELOW_NISAB','HAWL_PENDING','DUE'] }, rate: { type: 'string', example: '0.025' },
    calendar: { type: 'string', enum: ['HIJRI_LUNAR'] }, grossAssets: amount, netZakatableAssets: amount, nisabAmount: amount,
    meetsNisab: { type: 'boolean' }, dueAmount: amount, estimatedZakat: amount, monthlySavingSuggestion: amount,
    monthlySuggestionIsObligation: { type: 'boolean', enum: [false] }, reference: { type: 'object' }, quote: { type: 'object' }, notice: { type: 'string' } } };
  schemas.ZakatSaveCycle = { type: 'object', additionalProperties: false, required: ['requestKey','dueDate','calculation'], properties: { requestKey: key, dueDate: { ...date, description: 'Actual assessed due date, equal to asOfDate, not in the future.' }, calculation: ref('ZakatCalculationInput') } };
  schemas.ZakatPaymentInput = { type: 'object', additionalProperties: false, required: ['requestKey','currency','amount','paidOn'], properties: { requestKey: key, currency, amount: { ...amount, description: 'Positive amount in currency minor units, e.g. 2 decimals EGP/USD, 3 KWD, 0 JPY.' }, paidOn: { ...date, description: 'On/after cycle due date and not in the future. User-reported actual payment, not a saving allocation.' } } };
  schemas.CharityReminderPatch = { type: 'object', additionalProperties: false, minProperties: 1, properties: { enabled: { type: 'boolean' }, localTime: { type: 'string', pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$', example: '12:00' }, weekdays: { type: 'array', minItems: 1, maxItems: 7, uniqueItems: true, items: { type: 'integer', minimum: 0, maximum: 6 }, example: [5], description: '0=Sunday ... 5=Friday ... 6=Saturday, in user timezone.' }, language: { type: 'string', enum: ['ar','en'] } } };
  schemas.ZakatCycle = { type: 'object', properties: { id: key, currency, dueDate: date, assessment: ref('ZakatAssessment'), dueAmount: amount, recordedPaidAmount: amount, remainingAmount: amount, excessRecordedAmount: amount, paidPercent: { type: 'number', minimum: 0, maximum: 100 }, paymentVerification: { type: 'string', enum: ['USER_REPORTED'] } } };
  const operation = (summary: string, publicRoute = false, requestSchema?: string, responseSchema?: any, tag = 'Zakat') => ({ tags: [tag], summary,
    security: publicRoute ? [] : [{ bearerAuth: [] }], ...(requestSchema ? { requestBody: body(requestSchema) } : {}),
    responses: { '200': { description: 'Standard success envelope: read data for the result. No-store response.', content: { 'application/json': { schema: { allOf: [ref('ApiResponse'), { type: 'object', properties: { data: responseSchema ?? { type: 'object' } } }] } } } },
      '400': { $ref: '#/components/responses/BadRequest' }, ...(!publicRoute ? { '401': { $ref: '#/components/responses/Unauthorized' }, '404': { description: 'Record does not exist or belongs to another user' }, '409': { description: 'Request key reused with different data' } } : {}) } });
  Object.assign(spec.paths, {
    '/zakat/config': { get: operation('Calculator references, live-price configuration and rollout policy', true) },
    '/zakat/metal-prices': { get: { ...operation('Signed live global spot quote in selected currency; 503 if missing key, expired data or provider outage', true), parameters: [
      { in: 'query', name: 'currency', required: true, schema: currency },
      { in: 'query', name: 'nisabBasis', required: true, schema: schemas.ZakatCalculationInput.properties.nisabBasis },
      { in: 'query', name: 'timezone', schema: { type: 'string', default: 'UTC', example: 'Africa/Cairo' } },
    ] } },
    '/zakat/calculate': { post: operation('Stateless lunar-year monetary Zakat estimate; does not save assets', true, 'ZakatCalculationInput', ref('ZakatAssessment')) },
    '/zakat/summary': { get: operation('Private latest-cycle summary and experience policy') },
    '/zakat/cycles': { get: operation('Paginated private cycles', false, undefined, { type: 'object', properties: { items: { type: 'array', items: ref('ZakatCycle') }, nextCursor: { type: 'string', format: 'uuid', nullable: true } } }), post: operation('Save a due assessment once; immutable calculation snapshot', false, 'ZakatSaveCycle', ref('ZakatCycle')) },
    '/zakat/cycles/{cycleId}': { get: operation('Private cycle and aggregated user-reported settlement', false, undefined, ref('ZakatCycle')), delete: operation('Delete private cycle and its payment entries') },
    '/zakat/cycles/{cycleId}/payments': { get: operation('Paginated user-reported payment entries'), post: operation('Record an actual payment once; no payment gateway', false, 'ZakatPaymentInput') },
    '/zakat/cycles/{cycleId}/payments/{paymentId}': { delete: operation('Remove a mistaken private ledger entry; retry-safe') },
    '/charity/reminder-preferences': { get: operation('Optional charity reminder; default off, Friday 12:00', false, undefined, undefined, 'Charity'), patch: operation('Update reminder preferences; BACKEND_FCM is the sole scheduler', false, 'CharityReminderPatch', undefined, 'Charity') },
  });
  spec.paths['/zakat/metal-prices'].get.responses['503'] = { description: 'METAL_PRICES_UNAVAILABLE: missing key, provider rejection/quota, timeout, invalid units or stale data. No fallback price.' };
  for (const path of ['/zakat/cycles','/zakat/cycles/{cycleId}/payments']) {
    spec.paths[path].get.parameters = [
      { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 } },
      { in: 'query', name: 'cursor', schema: { type: 'string', format: 'uuid' }, description: 'Use the previous nextCursor. Cursor must belong to this account/cycle.' },
    ];
  }
  if (spec.paths['/journey/weekly-summary']?.get) spec.paths['/journey/weekly-summary'].get.summary = 'Weekly summary: Prayer, Quran and Adhkar; charity is excluded';
  const legacy = spec.paths['/journey/sadaqah'];
  if (legacy) for (const method of ['get','patch']) if (legacy[method]) {
    legacy[method].deprecated = true;
    legacy[method].description = 'Legacy private monetary tracking retained temporarily for older clients. New clients use charity reminders and Zakat. Monetary entries do not contribute to daily journey completion or charity points.';
  }
  schemas.DashboardResponse.properties.zakat = { type: 'object', description: 'New Home tile. Read state: NOT_CALCULATED / ASSESSED / UNAVAILABLE. Latest cycle totals are private; mask them by default.' };
  schemas.DashboardResponse.properties.charityExperience = { type: 'object', description: 'Version 2: replace Sadaqah tile with Zakat; only Prayer/Quran/Adhkar count toward daily completion.' };
}
