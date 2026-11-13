import { z } from 'zod';
import { learningProgressSchema } from '../../services/learning.service';

export function addLearningOpenApi(spec: any) {
  const schemas = (spec.components ??= {}).schemas ??= {};
  schemas.LearningProgressInput = z.toJSONSchema(learningProgressSchema, { io: 'input', target: 'openapi-3.0', unrepresentable: 'any' });
  const description = 'Learning hub («تعلّم مع نور»): prophet stories, seerah, aqeedah, asma al-husna, fiqh, tajweed, an-Nawawi\'s Forty. '
    + 'Quran text is copied verbatim from the app Quran text and hadith verbatim from Sahih al-Bukhari / Sahih Muslim with their numbers, verified at build time. '
    + 'Every item in the build is live. Companions and morals list existingEndpoint instead of items. '
    + 'Public content (Cache-Control public, max-age=600); with a token the response adds the user progress (private, no-store).';
  const ok = { '200': { description: 'Standard Noor success envelope' }, '404': { description: 'Section or item not found' } };
  const id = (name: string) => ({ in: 'path', name, required: true, schema: { type: 'string', pattern: '^[a-z0-9-]+$' } });
  spec.paths['/learning'] = { get: { tags: ['Learning'], summary: 'Learning hub: sections, counts, coming-soon flags, continue reading', description, responses: ok } };
  spec.paths['/learning/collections/{id}'] = { get: { tags: ['Learning'], summary: 'One section with its item list', description, parameters: [id('id')], responses: ok } };
  spec.paths['/learning/items/{id}'] = { get: { tags: ['Learning'], summary: 'One story / lesson / hadith: sections with verbatim ayat (verseKey for audio and tafsir), hadith excerpts, reflections, key points, quiz', description, parameters: [id('id')], responses: ok } };
  spec.paths['/learning/items/{id}/listen'] = { get: { tags: ['Learning'], summary: '«استمع»: ordered listening script (title, ayah, tafsir, hadith, narration segments)',
    description: 'Ayah segments are recited with the user\'s reciter via /quran/audio/playlist, never text-to-speech. Tafsir segments are «التفسير الميسر» (King Fahd Complex) for the recited ayat, '
      + 'verified letter for letter against tafsir.app; speechAr drops Quran wording quoted inside it. mode SOURCES (stories, seerah, aqeedah, asma, Nawawi) has no Noor wording; '
      + 'mode LESSON (fiqh, tajweed) adds narration segments with editorial: true. Item responses also carry quran[].tafsir and tafsirSource.',
    parameters: [id('id')], responses: ok } };
  spec.paths['/learning/items/{id}/progress'] = { put: { tags: ['Learning'], summary: 'Save reading progress (furthest section, completion, best quiz score)', description,
    security: [{ bearerAuth: [] }], parameters: [id('id')],
    requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LearningProgressInput' } } } },
    responses: { ...ok, '400': { description: 'Invalid section index or quiz total' }, '401': { description: 'Authentication required' } } } };
}
