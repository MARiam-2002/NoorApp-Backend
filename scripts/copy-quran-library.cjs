const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const src = path.join(__dirname, '../src/shared/data/quran-library');
const dest = path.join(__dirname, '../dist/shared/data/quran-library');
const manifest = JSON.parse(fs.readFileSync(path.join(src, 'manifest.json'), 'utf8'));
fs.mkdirSync(dest, { recursive: true });
fs.copyFileSync(path.join(src, 'manifest.json'), path.join(dest, 'manifest.json'));
for (const [name, meta] of Object.entries(manifest.files)) {
  const bytes = fs.readFileSync(path.join(src, meta.file));
  if (crypto.createHash('sha256').update(bytes).digest('hex') !== meta.sha256) throw new Error(`Quran library checksum mismatch: ${name}`);
  fs.copyFileSync(path.join(src, meta.file), path.join(dest, meta.file));
}
console.log(`Copied ${Object.keys(manifest.files).length} checksum-verified Quran library datasets.`);
