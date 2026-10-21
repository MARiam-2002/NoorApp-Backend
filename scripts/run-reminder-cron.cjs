'use strict';

// Safety-net trigger only. The API's minute scheduler and database delivery claims
// remain authoritative; never replay historical prayer times here.
const DEFAULT_URL = 'https://noorapp-backend-production.up.railway.app/api/v1/cron/prayer-reminders';

function validateUrl(value) {
  const url = new URL(value);
  const privateHost = url.hostname.endsWith('.railway.internal');
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && privateHost)) ||
      url.username || url.password || url.search || url.hash ||
      url.pathname !== '/api/v1/cron/prayer-reminders') {
    throw new Error('INVALID_CRON_ENDPOINT');
  }
  return url.toString();
}

async function runReminderTrigger(options = {}) {
  const secret = options.secret ?? process.env.CRON_SECRET;
  if (!secret || !secret.trim()) throw new Error('MISSING_CRON_SECRET');
  const urls = [options.url ?? process.env.REMINDER_CRON_URL ?? DEFAULT_URL];
  const fallback = options.fallbackUrl ?? process.env.REMINDER_CRON_FALLBACK_URL;
  if (fallback) urls.push(fallback);
  urls.forEach(validateUrl);
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const log = options.log ?? (entry => console.log(JSON.stringify(entry)));

  for (let attempt = 1; attempt <= 4; attempt++) {
    let response;
    let failure;
    try {
      response = await fetchImpl(urls[Math.min(attempt - 1, urls.length - 1)], {
        method: 'POST',
        headers: { 'x-cron-secret': secret.trim(), accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(20_000),
      });
      // Consume the body inside the deadline too. Never log its contents.
      const body = await response.json();
      if (response.ok && body?.success === true) {
        const result = { event: 'reminder_trigger_completed', attempt,
          requestId: typeof body.requestId === 'string' ? body.requestId.slice(0, 80) : undefined };
        log(result);
        return result;
      }
      failure = response.ok ? 'INVALID_RESPONSE' : `HTTP_${response.status}`;
    } catch {
      failure = response ? (response.ok ? 'INVALID_RESPONSE' : `HTTP_${response.status}`) : 'NETWORK_OR_TIMEOUT';
    }
    const retryable = failure === 'NETWORK_OR_TIMEOUT' || failure === 'HTTP_429' || /^HTTP_5\d\d$/.test(failure);
    log({ event: 'reminder_trigger_attempt_failed', attempt, code: failure, retryable });
    if (!retryable || attempt === 4) throw new Error(`REMINDER_TRIGGER_FAILED:${failure}`);
    await sleep([1_000, 3_000, 7_000][attempt - 1]);
  }
}

module.exports = { runReminderTrigger, validateUrl };
if (require.main === module) {
  runReminderTrigger().catch(error => {
    // Only our stable error codes are emitted, never fetch errors/URLs/credentials.
    const message = String(error.message);
    console.error(JSON.stringify({ event: 'reminder_trigger_failed', code:
      /^(MISSING_CRON_SECRET|INVALID_CRON_ENDPOINT|REMINDER_TRIGGER_FAILED:)/.test(message) ? message : 'INVALID_CONFIGURATION' }));
    process.exitCode = 1;
  });
}
