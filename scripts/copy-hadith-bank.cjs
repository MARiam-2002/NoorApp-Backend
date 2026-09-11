const fs = require('node:fs');
const path = require('node:path');

const src = path.join(__dirname, '..', 'src', 'shared', 'data', 'verified-sahih-hadith-bank.json');
const destDir = path.join(__dirname, '..', 'dist', 'shared', 'data');
const dest = path.join(destDir, 'verified-sahih-hadith-bank.json');

if (!fs.existsSync(src)) {
  console.error('Missing hadith bank at', src);
  process.exit(1);
}
fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log('Copied verified hadith bank to', dest);
