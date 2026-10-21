'use strict';
const assert = require('node:assert/strict');
const { runReminderTrigger, validateUrl } = require('./run-reminder-cron.cjs');

async function main() {
  const logs = [];
  const waits = [];
  const secret = 'test-only-cron-secret';
  const base = { secret, log: entry => logs.push(entry), sleep: async ms => waits.push(ms) };
  let calls = 0;
  const result = await runReminderTrigger({ ...base, fetchImpl: async (url, options) => {
    calls++;
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['x-cron-secret'], secret);
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    assert.ok(!url.includes(secret));
    if (calls === 1) throw new Error('untrusted error containing ' + secret);
    if (calls === 2) return { ok: false, status: 503, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ success: true, requestId: 'safe-id' }) };
  }});
  assert.equal(result.attempt, 3);
  assert.deepEqual(waits, [1000, 3000]);
  assert.ok(!JSON.stringify(logs).includes(secret));
  calls = 0;
  await assert.rejects(runReminderTrigger({ ...base, fetchImpl: async () => {
    calls++; return { ok: false, status: 401, json: async () => ({}) };
  }}), /HTTP_401/);
  assert.equal(calls, 1, 'Authorization failure must not retry');
  calls = 0;
  await assert.rejects(runReminderTrigger({ ...base, fetchImpl: async () => {
    calls++; throw new Error('network down');
  }}), /NETWORK_OR_TIMEOUT/);
  assert.equal(calls, 4, 'Network retries must be bounded');
  await assert.rejects(runReminderTrigger({ ...base, fetchImpl: async () => ({
    ok: true, status: 200, json: async () => ({success: false}),
  })}), /INVALID_RESPONSE/);
  await assert.rejects(runReminderTrigger({ ...base, secret: '' }), /MISSING_CRON_SECRET/);
  assert.throws(() => validateUrl('https://example.com/api/v1/cron/prayer-reminders?secret=bad'));
  assert.throws(() => validateUrl('http://example.com/api/v1/cron/prayer-reminders'));
  const privateUrl = 'http://noorapp-backend.railway.internal:3000/api/v1/cron/prayer-reminders';
  assert.equal(validateUrl(privateUrl), privateUrl);
  const targets = [];
  await runReminderTrigger({ ...base, url: privateUrl,
    fallbackUrl: 'https://noorapp-backend-production.up.railway.app/api/v1/cron/prayer-reminders',
    fetchImpl: async url => {
      targets.push(url);
      if (targets.length === 1) throw new Error('private connection down');
      return { ok: true, status: 200, json: async () => ({success: true}) };
    }});
  assert.equal(targets[0], privateUrl);
  assert.ok(targets[1].startsWith('https:'));
  console.log('Reminder trigger checks passed: bounded retries, network/503 recovery, auth fail-fast, strict response, private fallback, secret-safe logs. No network or database used.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
