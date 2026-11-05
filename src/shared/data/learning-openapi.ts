import { z } from 'zod';
import { learningProgressSchema } from '../../services/learning.service';

export function addLearningOpenApi(spec: any) {
  const schemas = (spec.components ??= {}).schemas ??= {};
  schemas.LearningProgressInput = z.toJSONSchema(learningProgressSchema, { io: 'input', target: 'openapi-3.0', unrepresentable: 'any' });
  const description = 'Learning hub («تعلّم مع نور»): prophet stories, seerah, aqeedah, asma al-husna, fiqh, tajweed, an-Nawawi\'s Forty. '
    + 'Quran text is copied verbatim from the app Quran text and hadith verbatim from Sahih al-Bukhari / Sahih Muslim with their numbers, verified at build time. '
    + 'Production returns scholar-approved items only (Staging can show drafts with draft=true). Companions and morals list existingEndpoint instead of items. '
    + 'Public content (Cache-Control public, max-age=600); with a token the response adds the user progress (private, no-store).';
  const ok = { '200': { description: 'Standard Noor success envelope' }, '404': { description: 'Section or item not found (or not approved yet)' } };
  const id = (name: string) => ({ in: 'path', name, required: true, schema: { type: 'string', pattern: '^[a-z0-9-]+$' } });
  spec.paths['/learning'] = { get: { tags: ['Learning'], summary: 'Learning hub: sections, counts, coming-soon flags, continue reading', description, responses: ok } };
  spec.paths['/learning/collections/{id}'] = { get: { tags: ['Learning'], summary: 'One section with its item list', description, parameters: [id('id')], responses: ok } };
  spec.paths['/learning/items/{id}'] = { get: { tags: ['Learning'], summary: 'One story / lesson / hadith: sections with verbatim ayat (verseKey for audio and tafsir), hadith excerpts, reflections, key points, quiz', description, parameters: [id('id')], responses: ok } };
  spec.paths['/learning/items/{id}/progress'] = { put: { tags: ['Learning'], summary: 'Save reading progress (furthest section, completion, best quiz score)', description,
    security: [{ bearerAuth: [] }], parameters: [id('id')],
    requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LearningProgressInput' } } } },
    responses: { ...ok, '400': { description: 'Invalid section index or quiz total' }, '401': { description: 'Authentication required' } } } };
}
