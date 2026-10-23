import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { getSupportInfo } from '../src/services/support.service';
import { supportRouter } from '../src/routes/support';

async function main() {
  const support = getSupportInfo({ SUPPORT_WHATSAPP_NUMBER: '+12025550123', SUPPORT_EMAIL: 'support@example.com' });
  assert.equal(support.whatsapp.phoneE164, '+12025550123');
  assert.equal(support.whatsapp.url, 'https://wa.me/12025550123');
  assert.equal(support.email.address, 'support@example.com');
  assert.equal(support.businessHours, null);
  assert.equal(new URL(support.whatsapp.urlAr!).searchParams.get('text'), 'مرحبًا، أحتاج مساعدة في تطبيق نور.');
  assert.ok(support.email.urlAr?.startsWith('mailto:support@example.com?subject='));
  assert.ok(!support.responseMessageEn.includes('24/7'));
  assert.equal(new Set(support.faqs.map(f => f.id)).size, support.faqs.length);
  const formatted = getSupportInfo({ SUPPORT_WHATSAPP_NUMBER: '+1 (202) 555-0123' });
  assert.equal(formatted.whatsapp.url, support.whatsapp.url);
  const invalid = getSupportInfo({ SUPPORT_WHATSAPP_NUMBER: 'https://evil.invalid', SUPPORT_EMAIL: 'a@example.com\r\nBcc: other@example.com' });
  assert.equal(invalid.whatsapp.enabled, false); assert.equal(invalid.whatsapp.urlAr, null);
  assert.equal(invalid.email.enabled, false); assert.equal(invalid.email.urlAr, null);
  const app = express(); app.use('/api/v1/support', supportRouter);
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>(resolve => server.once('listening', resolve));
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/support`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'public, max-age=300');
    const body = await response.json() as any;
    assert.equal(body.success, true); assert.equal(body.data.schemaVersion, 1);
    assert.ok(Array.isArray(body.data.faqs));
    console.log('Support tests passed: public HTTP, exact contacts, encoded links, safe invalid config and no invented hours. No database or external messages.');
  } finally { await new Promise<void>((resolve,reject) => server.close(e => e ? reject(e) : resolve())); }
}
main().catch(e => {console.error(e); process.exitCode = 1;});
