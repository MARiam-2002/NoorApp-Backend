'use strict';
// Targeted, reversible content repair. Never rewrites a whole catalog or user data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PrismaClient } = require('@prisma/client');
const BAD = 'عَلِمَ مَا بَيْنَ أَيْدِيهِمْ';
const GOOD = 'يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ';

async function main() {
  const snapshotPath = process.argv[2];
  const apply = process.argv.includes('--apply');
  assert.ok(snapshotPath, 'A public-content snapshot path is required');
  const approved = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  assert.equal(approved.length, 6);
  const url = new URL(process.env.NOOR_CONTENT_REPAIR_DATABASE_URL ?? '');
  assert.ok(url.hostname.endsWith('.rlwy.net'), 'Expected the explicitly selected Railway TCP database proxy');
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  try {
    const where = { textAr: { contains: BAD }, AND: { textAr: { contains: 'كُرْسِيُّهُ' } } };
    const rows = await db.dhikrItem.findMany({ where, select: { id: true, textAr: true, textArPlain: true } });
    assert.deepEqual(rows.map(r => r.id).sort(), approved.map(r => r.id).sort(), 'Only the six verified public catalog records may be changed');
    for (const row of rows) {
      assert.equal(row.textAr, approved.find(r => r.id === row.id).textAr, 'Content changed since public snapshot; stop');
      assert.equal(row.textAr.split(BAD).length - 1, 1);
    }
    console.log(JSON.stringify({ event: 'kursi_content_repair_checked', affectedItems: rows.length, apply }));
    if (!apply) return;
    // Save the original derived text too. Refuse to overwrite an earlier recovery file.
    fs.writeFileSync(snapshotPath + '.database-before.json', JSON.stringify(rows, null, 2), { flag: 'wx' });
    await db.$transaction(async tx => {
      for (const row of rows) {
        const changed = await tx.dhikrItem.updateMany({
          where: { id: row.id, textAr: row.textAr },
          data: { textAr: row.textAr.replace(BAD, GOOD), textArPlain: null },
        });
        assert.equal(changed.count, 1, 'Concurrent content edit; rolling back all changes');
      }
    });
    const after = await db.dhikrItem.findMany({ where: { id: { in: rows.map(r => r.id) } }, select: { id: true, textAr: true } });
    assert.equal(after.length, 6);
    assert.ok(after.every(r => r.textAr.includes(GOOD) && !r.textAr.includes(BAD)));
    console.log(JSON.stringify({ event: 'kursi_content_repair_verified', affectedItems: after.length }));
  } finally { await db.$disconnect(); }
}
main().catch(error => {
  // No connection URLs or credentials in maintenance logs.
  console.error(JSON.stringify({ event: 'kursi_content_repair_failed', type: error.name, code: error.code ?? null }));
  process.exitCode = 1;
});
