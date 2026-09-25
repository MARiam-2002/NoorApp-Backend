/**
 * Production smoke for /stances/*
 * Run: npx tsx scripts/smoke-stances-production.ts
 */
const BASE = process.env.API_BASE || 'https://noorapp-backend-production.up.railway.app/api/v1';

async function req(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, init);
  const json = await res.json();
  return { status: res.status, json };
}

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function waitForCatalog80(maxTries = 20) {
  for (let i = 1; i <= maxTries; i++) {
    const { status, json } = await req('/stances/catalog');
    const count = json?.data?.count;
    console.log(`poll ${i}/${maxTries} http=${status} count=${count}`);
    if (status === 200 && count === 80) return;
    await new Promise((r) => setTimeout(r, 15000));
  }
  throw new Error('Production did not reach catalog count=80 in time');
}

async function main() {
  console.log('BASE', BASE);
  await waitForCatalog80();

  const today = await req('/stances/today');
  assert(today.status === 200 && today.json.success, 'today failed');
  const sit = today.json.data.situation;
  assert(sit?.options?.length === 3, 'expected 3 options');
  assert(sit.catalogSize === 80, `expected catalogSize 80 got ${sit.catalogSize}`);
  assert(today.json.data.reveal == null || today.json.data.situation.alreadyAnswered, 'reveal should be null if not answered');
  console.log('PASS today', sit.id, sit.labelAr);

  const answer = await req(`/stances/${sit.id}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ selectedOptionKey: 'A' }),
  });
  assert(answer.status === 200 && answer.json.success, 'answer failed');
  assert(answer.json.data.reveal?.rulingAr, 'missing rulingAr');
  assert(answer.json.data.reveal?.sourceAr, 'missing sourceAr');
  assert(answer.json.data.rulingTitleAr === 'الرأي الشرعي والأصح', 'ruling title');
  assert(answer.json.data.nextCtaAr === 'الموقف التالي', 'next CTA');
  console.log('PASS guest answer', {
    isCorrect: answer.json.data.reveal.isCorrect,
    points: answer.json.data.reveal.pointsAwarded,
  });

  const next = await req(`/stances/next?afterId=${encodeURIComponent(sit.id)}`);
  assert(next.status === 200 && next.json.success, 'next failed');
  assert(next.json.data.situation.id !== sit.id, 'next should differ');
  console.log('PASS next', next.json.data.situation.id);

  const email = `stance.prod.${Date.now()}@noor.test`;
  const sign = await req('/auth/sign-up', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'SmokeTest123!', fullName: 'Stance Prod' }),
  });
  const token = sign.json?.data?.tokens?.accessToken;
  assert(token, 'signup token missing');

  const a1 = await req('/stances/stance_001/answer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ selectedOptionKey: 'A' }),
  });
  assert(a1.json.success, 'auth answer failed');
  assert(a1.json.data.reveal.pointsAwarded > 0, 'expected points');
  assert(a1.json.data.reveal.isCorrect === true, 'stance_001 correct is A');

  const a2 = await req('/stances/stance_001/answer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ selectedOptionKey: 'B' }),
  });
  assert(a2.json.data.alreadyAnswered === true, 'expected idempotent');
  assert(a2.json.data.reveal.selectedOptionKey === 'A', 'saved selection must stick');
  console.log('PASS auth points + idempotent');

  console.log('ALL PRODUCTION CHECKS PASSED');
}

main().catch((e) => {
  console.error('FAIL', e);
  process.exit(1);
});
