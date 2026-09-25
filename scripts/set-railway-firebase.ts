/**
 * Set FIREBASE_SERVICE_ACCOUNT_JSON on the linked Railway service, then redeploy.
 *
 * Prerequisites:
 *   1. railway login   (or RAILWAY_TOKEN)
 *   2. railway link    (select Noor production service)
 *   3. .firebase-sa.production.json exists (created locally; gitignored)
 *
 * Run:
 *   npx tsx scripts/set-railway-firebase.ts
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const saPath = path.join(process.cwd(), '.firebase-sa.production.json');
if (!fs.existsSync(saPath)) {
  console.error('Missing .firebase-sa.production.json');
  process.exit(1);
}

const json = fs.readFileSync(saPath, 'utf8').trim();
JSON.parse(json); // validate

const railway = 'npx --yes @railway/cli';

console.log('Checking Railway auth...');
try {
  const who = execSync(`${railway} whoami`, { encoding: 'utf8' });
  console.log(who.trim());
} catch {
  console.error('Not logged in. Run: npx @railway/cli login');
  console.error('Or set RAILWAY_TOKEN, then re-run this script.');
  process.exit(1);
}

console.log('Setting FIREBASE_SERVICE_ACCOUNT_JSON (value not printed)...');
execSync(`${railway} variables --set "FIREBASE_SERVICE_ACCOUNT_JSON=${json.replace(/"/g, '\\"')}"`, {
  stdio: 'inherit',
  env: process.env,
  shell: true,
});

console.log('Triggering redeploy...');
try {
  execSync(`${railway} up --detach`, { stdio: 'inherit', shell: true });
} catch {
  console.log('railway up failed or not needed — GitHub auto-deploy / variable change may redeploy.');
}

console.log('Done. Poll: curl -s https://noorapp-backend-production.up.railway.app/api/v1/health');
