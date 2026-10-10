import assert from 'node:assert/strict';
import { env } from '../src/config';
import { getEmailProviderStatus, sendVerificationEmail, sendPasswordResetEmail } from '../src/lib/email';
async function main() {
 const old={provider:env.EMAIL_PROVIDER,key:env.BREVO_API_KEY,from:env.MAIL_FROM,enabled:env.MAIL_ENABLED};const realFetch=globalThis.fetch;let calls=0;let status=201;let body:any={messageId:'isolated-test'};let failure=false;
 try {
  env.EMAIL_PROVIDER='brevo';env.BREVO_API_KEY='test-key-not-a-secret';env.MAIL_FROM='Noor <sender@example.com>';env.MAIL_ENABLED=true;
  globalThis.fetch=async(url:any,opts:any)=>{calls++;assert.equal(url,'https://api.brevo.com/v3/smtp/email');assert.equal(opts.method,'POST');assert.equal(opts.headers['api-key'],'test-key-not-a-secret');assert(opts.signal);const payload=JSON.parse(opts.body);assert.equal(payload.sender.email,'sender@example.com');assert.equal(payload.to[0].email,'test@example.com');assert(payload.textContent && payload.htmlContent);if(failure)throw new Error('Simulated timeout');return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});};
  assert.equal(getEmailProviderStatus().provider,'brevo');assert(await sendVerificationEmail('012345','test@example.com'));assert.equal(calls,1);
  assert((await sendPasswordResetEmail('test-reset-token','test@example.com')).sent);assert.equal(calls,2);
  status=401;assert.equal(await sendVerificationEmail('012345','test@example.com'),false);
  status=201;body={};assert.equal(await sendVerificationEmail('012345','test@example.com'),false);
  failure=true;assert.equal(await sendVerificationEmail('012345','test@example.com'),false);failure=false;
  env.MAIL_FROM='bad-sender';const before=calls;assert.equal(await sendVerificationEmail('012345','test@example.com'),false);assert.equal(calls,before);
  env.BREVO_API_KEY='';assert.equal(getEmailProviderStatus().provider,'mock');
  console.log('Brevo HTTPS request, sender parsing, verification/reset routing, provider rejection, missing receipt, timeout and invalid config checks passed. Fetch mocked; no email sent.');
 }finally{globalThis.fetch=realFetch;env.EMAIL_PROVIDER=old.provider;env.BREVO_API_KEY=old.key;env.MAIL_FROM=old.from;env.MAIL_ENABLED=old.enabled;}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
