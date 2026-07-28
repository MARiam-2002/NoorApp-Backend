async function runAllTests() {
  const rand = Math.random().toString(36).slice(2, 10);
  const BASE = 'http://localhost:3000/api/v1';
  let accessToken = null;
  let testUserEmail = null;
  let testUserPassword = 'StrongPass123!';
  const results = [];

  function logResult(name, status, expected, details = '') {
    const passed = status === expected;
    results.push({ name, status, expected, passed, details });
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${name}`);
    console.log(`   Status: ${status} (Expected: ${expected})`);
    if (details) console.log(`   ${details}`);
    console.log('');
  }

  // ======= TEST 1: Sign-up WITH fullName (like screen) =======
  console.log('\n═══════════════════════════════════════════════');
  console.log('TEST 1: التسجيل ببيانات كاملة (مع fullName)');
  console.log('═══════════════════════════════════════════════');
  testUserEmail = `test_user_${rand}@gmail.com`;
  let body = {
    fullName: 'أحمد محمد علي',
    email: testUserEmail,
    password: testUserPassword
  };
  let resp = await fetch(`${BASE}/auth/sign-up`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  let json = await resp.json();
  const t1Details = [
    `success: ${json?.success}`,
    `fullName: ${JSON.stringify(json?.data?.user?.fullName)}`,
    `username (auto-generated): ${JSON.stringify(json?.data?.user?.username)}`,
    `email: ${JSON.stringify(json?.data?.user?.email)}`,
    `hasAccessToken: ${!!json?.data?.tokens?.accessToken}`,
    `hasRefreshToken: ${!!json?.data?.tokens?.refreshToken}`,
  ].join('\n   ');
  logResult('TEST 1: Sign-up with fullName', resp.status, 201, t1Details);

  // ======= TEST 2: Sign-up WITHOUT fullName =======
  console.log('\n═══════════════════════════════════════════════');
  console.log('TEST 2: التسجيل بدون fullName');
  console.log('═══════════════════════════════════════════════');
  let rand2 = Math.random().toString(36).slice(2, 10);
  body = {
    email: `nofullname_${rand2}@gmail.com`,
    password: testUserPassword
  };
  resp = await fetch(`${BASE}/auth/sign-up`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  json = await resp.json();
  const t2Details = [
    `success: ${json?.success}`,
    `fullName (nullable): ${JSON.stringify(json?.data?.user?.fullName)}`,
    `username (auto-generated): ${JSON.stringify(json?.data?.user?.username)}`,
    `email: ${JSON.stringify(json?.data?.user?.email)}`,
    `hasAccessToken: ${!!json?.data?.tokens?.accessToken}`,
  ].join('\n   ');
  logResult('TEST 2: Sign-up WITHOUT fullName', resp.status, 201, t2Details);

  // ======= TEST 3: DUPLICATE email =======
  console.log('\n═══════════════════════════════════════════════');
  console.log('TEST 3: التسجيل بحساب مكرر (duplicate email)');
  console.log('═══════════════════════════════════════════════');
  body = {
    fullName: 'حساب مكرر',
    email: testUserEmail,
    password: testUserPassword
  };
  resp = await fetch(`${BASE}/auth/sign-up`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  json = await resp.json();
  const t3Details = [
    `success: ${json?.success}`,
    `code: ${json?.code ?? json?.errorCode}`,
    `message: ${json?.message}`,
    `details.field: ${json?.details?.field ?? 'N/A'}`,
  ].join('\n   ');
  logResult('TEST 3: Duplicate email', resp.status, 409, t3Details);

  // ======= TEST 4: Login + Dashboard =======
  console.log('\n═══════════════════════════════════════════════');
  console.log('TEST 4: تسجيل الدخول + اختبار لوحة التحكم /dashboard');
  console.log('═══════════════════════════════════════════════');

  // 4a: Login
  body = { email: testUserEmail, password: testUserPassword };
  resp = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  json = await resp.json();
  accessToken = json?.data?.tokens?.accessToken;
  const t4aDetails = [
    `success: ${json?.success}`,
    `user.email: ${json?.data?.user?.email}`,
    `hasAccessToken: ${!!accessToken}`,
  ].join('\n   ');
  logResult('TEST 4a: Login', resp.status, 200, t4aDetails);

  // 4b: Dashboard
  if (accessToken) {
    resp = await fetch(`${BASE}/dashboard`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'accept': 'application/json'
      }
    });
    json = await resp.json();
    const dashboardKeys = json?.data ? Object.keys(json.data) : [];
    const t4bDetails = [
      `success: ${json?.success}`,
      `message: ${json?.message}`,
      `data keys (${dashboardKeys.length}): [${dashboardKeys.join(', ')}]`,
    ].join('\n   ');
    logResult('TEST 4b: GET /dashboard', resp.status, 200, t4bDetails);
  } else {
    logResult('TEST 4b: GET /dashboard', 'SKIPPED', 200, 'No access token from login');
  }

  // ======= SUMMARY =======
  console.log('\n═══════════════════════════════════════════════');
  console.log('📊 SUMMARY: النتيجة النهائية');
  console.log('═══════════════════════════════════════════════');
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
  results.forEach((r, i) => {
    const icon = r.passed ? '✅' : '❌';
    console.log(`${icon} ${i + 1}. ${r.name} — ${r.status} (${r.passed ? 'PASS' : 'FAIL'})`);
  });
  console.log(`\nUser used for tests: ${testUserEmail} / ${testUserPassword}`);
  console.log('\n═══════════════════════════════════════════════');

  process.exit(results.every(r => r.passed) ? 0 : 1);
}

runAllTests().catch(err => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
