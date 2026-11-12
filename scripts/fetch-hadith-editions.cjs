#!/usr/bin/env node
/**
 * Downloads the Sahih al-Bukhari / Sahih Muslim / al-Nawawi / Jami' al-Tirmidhi editions (fawazahmed0/hadith-api) that the content
 * tests check citations against. The files are large and gitignored; CI fetches them with this script.
 * Each file is pinned by SHA-256, so a changed upstream file fails loudly instead of silently changing the checks.
 *
 *   node scripts/fetch-hadith-editions.cjs
 */
const { createHash } = require('node:crypto');
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const BASE = 'https://raw.githubusercontent.com/fawazahmed0/hadith-api/1/editions';
const DIR = join(__dirname, '..', 'prisma', 'data', 'hadith');
const FILES = {
  'ara-bukhari.json': 'e34a3402889ca378871da3c5984b7875c680920e93f1c8738ac7afe502179562',
  'ara-muslim.json': '194073b24090c5368e4d14a3f55c9e0ef144c7437bd7e5aa83aa4d2bc54a8ea0',
  'eng-muslim.json': '2ef51a2a1980fb91e395fbf1580cc9c9413297f54bb8cad271e1499417299488',
  'ara-nawawi.json': '91f559b90422005b768bb449426d87d2e6fabbb43ac3a31e5c24c50ca77465e6',
  'ara-tirmidhi.json': '408028cd56329ed78edbe3ad443beb96b58e16c3e5bd49f9bc7b0eac77c8820f',
  'eng-tirmidhi.json': 'f64f1a5e6f2614e164e3b10138412af322d3959011bf84d67f428f79b3858afb',
};

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

async function main() {
  mkdirSync(DIR, { recursive: true });
  for (const [file, expected] of Object.entries(FILES)) {
    const path = join(DIR, file);
    if (existsSync(path) && sha256(readFileSync(path)) === expected) {
      console.log(`ok   ${file} (already present)`);
      continue;
    }
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(`${BASE}/${file}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        const actual = sha256(buf);
        if (actual !== expected) throw new Error(`checksum mismatch: expected ${expected}, got ${actual}`);
        writeFileSync(path, buf);
        console.log(`got  ${file} (${buf.length} bytes)`);
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        console.warn(`retry ${file} (attempt ${attempt}): ${error.message}`);
      }
    }
    if (lastError) throw new Error(`Could not fetch ${file}: ${lastError.message}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
