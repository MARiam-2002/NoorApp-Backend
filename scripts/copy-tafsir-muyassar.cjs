// Copies the verified «التفسير الميسر» data into dist (see scripts/build-tafsir-muyassar.ts). The server re-checks the
// decompressed JSON against TAFSIR_MUYASSAR_FILE.jsonSha256 when it first loads it.
const fs = require('node:fs');
const path = require('node:path');
const src = path.join(__dirname, '../src/shared/data/tafsir-muyassar/muyassar.json.gz');
const dest = path.join(__dirname, '../dist/shared/data/tafsir-muyassar/muyassar.json.gz');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log('Copied verified Muyassar tafsir data.');
