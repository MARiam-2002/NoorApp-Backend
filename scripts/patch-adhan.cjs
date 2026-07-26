const fs = require('node:fs');
const path = require('node:path');

const adhanCjsDir = path.join(process.cwd(), 'node_modules', 'adhan', 'lib', 'cjs');
const targetFile = path.join(adhanCjsDir, 'package.json');

if (fs.existsSync(adhanCjsDir) && !fs.existsSync(targetFile)) {
  fs.writeFileSync(targetFile, JSON.stringify({ type: 'commonjs' }, null, 2));
  console.log('[patch-adhan] Fixed adhan package CJS module resolution');
} else if (!fs.existsSync(adhanCjsDir)) {
  console.warn('[patch-adhan] adhan package not found (expected node_modules/adhan)');
}
