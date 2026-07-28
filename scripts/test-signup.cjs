async function test() {
  const rand = Math.random().toString(36).slice(2, 10);

  // === Test 1: بالضبط زي الشاشة: 3 fields بس (اسم المستخدم + ايميل + باسورد) ===
  console.log('\n=== Test 1: EXACTLY like the screen (3 fields: fullName+email+password) ===');
  let body = {
    fullName: 'أحمد محمد علي',
    email: 'ahmedscreen_' + rand + '@gmail.com',
    password: 'StrongPass123!'
  };
  let resp = await fetch('http://localhost:3000/api/v1/auth/sign-up', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  let json = await resp.json();
  console.log('Status:', resp.status, '(expect 201)');
  console.log('success:', json?.success, '(expect true)');
  console.log('fullName:', JSON.stringify(json?.data?.user?.fullName), '(expect أحمد محمد علي)');
  console.log('username (auto generated):', JSON.stringify(json?.data?.user?.username), '(expect handle from email, NOT null)');
  console.log('username not null/empty?:', !!json?.data?.user?.username);
  console.log('email present:', JSON.stringify(json?.data?.user?.email));

  // === Test 2: بدون fullName (المطلوب الآن) ===
  console.log('\n=== Test 2: NO fullName (expect 400 error) ===');
  let rand2 = Math.random().toString(36).slice(2, 10);
  body = {
    email: 'nofullname_' + rand2 + '@gmail.com',
    password: 'StrongPass123!'
  };
  resp = await fetch('http://localhost:3000/api/v1/auth/sign-up', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  json = await resp.json();
  console.log('Status (expect 400):', resp.status);
  console.log('success (expect false):', json?.success);
  console.log('errors[0].field (expect fullName):', json?.errors?.[0]?.field);

  // === Test 3: without username field ===
  console.log('\n=== Test 3: NO username field (works fine! - auto-generated) ===');
  let rand3 = Math.random().toString(36).slice(2, 10);
  body = {
    fullName: 'مريم خالد',
    email: 'maryam_' + rand3 + '@gmail.com',
    password: 'StrongPass123!'
  };
  resp = await fetch('http://localhost:3000/api/v1/auth/sign-up', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  json = await resp.json();
  console.log('Status (expect 201):', resp.status);
  console.log('success (expect true):', json?.success);
  console.log('fullName:', JSON.stringify(json?.data?.user?.fullName));
  console.log('auto username not empty:', !!json?.data?.user?.username, '->', JSON.stringify(json?.data?.user?.username));

  // === Test 4: duplicate email ===
  console.log('\n=== Test 4: DUPLICATE email (expect 409) ===');
  body = {
    fullName: 'حساب تاني',
    email: 'maryam_' + rand3 + '@gmail.com',
    password: 'StrongPass123!'
  };
  resp = await fetch('http://localhost:3000/api/v1/auth/sign-up', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  json = await resp.json();
  console.log('Status (expect 409):', resp.status);
  console.log('success (expect false):', json?.success);
  console.log('code (expect CONFLICT):', json?.code);
  console.log('errors?.field:', json?.details?.field ?? '(details.field expected email)');

  console.log('\n=== ALL DONE ===');
}

test().then(() => process.exit(0));
