const fetch = require('node-fetch');

async function test() {
  // Sign up
  const email = `test${Date.now()}@test.com`;
  const signupRes = await fetch('https://noor-app-backend-one.vercel.app/api/v1/auth/sign-up', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName: 'Test', email, password: 'Test1234!' })
  });
  const signupData = await signupRes.json();
  const token = signupData.data.tokens.accessToken;
  
  // Get khatmah stats
  const statsRes = await fetch('https://noor-app-backend-one.vercel.app/api/v1/quran/khatmah/stats', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const stats = await statsRes.json();
  console.log('Response keys:', Object.keys(stats.data));
  console.log('Full response:', JSON.stringify(stats, null, 2));
}

test().catch(console.error);
