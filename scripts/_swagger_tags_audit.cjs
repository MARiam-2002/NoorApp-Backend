const fs = require('fs');
const path = require('path');
const dir = 'src/routes';
const tagToFiles = new Map();
const tagToOpsCount = new Map();
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));
for (const f of files) {
  const c = fs.readFileSync(path.join(dir, f), 'utf8');
  const blocks = c.match(/\/\*\*[\s\S]*?@openapi[\s\S]*?\*\//g) || [];
  for (const b of blocks) {
    const tagsMatch = b.match(/tags\s*:\s*\[([^\]]*)\]/);
    if (!tagsMatch) continue;
    const tags = tagsMatch[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    for (const t of tags) {
      if (!tagToFiles.has(t)) tagToFiles.set(t, new Set());
      tagToFiles.get(t).add(f);
      tagToOpsCount.set(t, (tagToOpsCount.get(t) || 0) + 1);
    }
  }
}
console.log('=== SWAGGER TAGS AUDIT (from @openapi JSDoc blocks) ===\n');
const all = [...tagToFiles.keys()].sort();
for (const tag of all) {
  const files = [...tagToFiles.get(tag)].join(', ');
  console.log('• ' + tag.padEnd(24) + ' ops=' + String(tagToOpsCount.get(tag)).padEnd(4) + ' files=' + files);
}
console.log('\nTOTAL TAGS: ' + all.length);
console.log('\n=== TAGS WITH 0 OPS (empty sections): ===');
for (const [tag, count] of tagToOpsCount) {
  if (count === 0) console.log('  EMPTY: ' + tag);
}
console.log('\n(If a tag shows with ops>=1 and still empty in UI, the swagger-jsdoc parser rejected its JSDoc block due to syntax.)');
