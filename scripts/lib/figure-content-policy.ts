import assert from 'node:assert/strict';

export type FigureStoryPolicyManifest = {
  catalogVersion: number;
  scope: { sectionNameAr: string; allowedCompanionTypes: string[]; sourceCollectionPolicy: string[] };
  references: Record<string, { collection: string; number: number; phrase: string }>;
  figures: Record<string, {
    companionType: string;
    summaryAr: string;
    paragraphs: { text: string; kind: string; references: string[] }[];
  }>;
};

type Definition = {
  id: string; summaryAr: string; storyAr: string[];
  evidence: { collection: string; number?: number; phrase: string }[];
};

/** Editorial scope/provenance guard, not a substitute for historical or scholarly review. */
export function validateFigureContentPolicy(
  definitions: readonly Definition[], manifest: FigureStoryPolicyManifest, version: number,
): void {
  assert.equal(manifest.catalogVersion, version, 'Figure source manifest version mismatch');
  assert.equal(manifest.scope.sectionNameAr, 'شخصية اليوم', 'Use the inclusive Figure of the Day section name');
  assert.deepEqual([...manifest.scope.allowedCompanionTypes].sort(), ['sahabi', 'sahabiyah']);
  assert.deepEqual([...manifest.scope.sourceCollectionPolicy].sort(), ['bukhari', 'muslim']);
  const ids = definitions.map(f => f.id);
  assert.equal(new Set(ids).size, ids.length, 'Duplicate figure IDs');
  assert.deepEqual(Object.keys(manifest.figures).sort(), [...ids].sort(), 'Every figure needs a complete source record');
  for (const figure of definitions) {
    const entry = manifest.figures[figure.id]!;
    assert.ok(['sahabi', 'sahabiyah'].includes(entry.companionType), `${figure.id}: only companions are in scope`);
    assert.equal(entry.summaryAr, figure.summaryAr, `${figure.id}: summary/source drift`);
    assert.deepEqual(entry.paragraphs.map(p => p.text), figure.storyAr, `${figure.id}: narrative/source drift`);
    assert.ok(entry.paragraphs.length >= 6, `${figure.id}: story must not regress to a short card summary`);
    for (const [index, para] of entry.paragraphs.entries()) {
      assert.ok(['narrative', 'reflection'].includes(para.kind), `${figure.id}: invalid paragraph kind`);
      assert.equal(para.kind === 'reflection', para.text.startsWith('للتأمل:'), `${figure.id}: label the editorial reflection`);
      assert.ok(para.references.length > 0, `${figure.id} paragraph ${index}: missing sources`);
      for (const key of para.references) {
        const reference = manifest.references[key];
        assert.ok(reference, `${figure.id}: unknown reference ${key}`);
        assert.ok(['bukhari', 'muslim'].includes(reference.collection), `${key}: unsupported collection`);
        assert.ok(figure.evidence.some(e => e.collection === reference.collection
          && e.number === reference.number && e.phrase === reference.phrase), `${figure.id}: unpinned reference ${key}`);
      }
    }
  }
}
