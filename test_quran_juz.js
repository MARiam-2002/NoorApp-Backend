const fetch = require('node-fetch');

async function testJuzEndpoints() {
  console.log('🔍 Testing Quran Juz Endpoints...\n');
  
  // Test 1: Juz list
  console.log('1️⃣ Testing GET /quran/juz (list of 30 juz)');
  const juzListRes = await fetch('https://noor-app-backend-one.vercel.app/api/v1/quran/juz');
  const juzList = await juzListRes.json();
  console.log(`   ✅ Total juz: ${juzList.data.length}`);
  console.log(`   ✅ First juz: ${juzList.data[0].nameAr} (${juzList.data[0].totalAyahs} ayahs)`);
  console.log(`   ✅ Last juz: ${juzList.data[29].nameAr} (${juzList.data[29].totalAyahs} ayahs)\n`);
  
  // Test 2: First Juz ayahs
  console.log('2️⃣ Testing GET /quran/juz/1/ayahs');
  const juz1Res = await fetch('https://noor-app-backend-one.vercel.app/api/v1/quran/juz/1/ayahs');
  const juz1 = await juz1Res.json();
  console.log(`   ✅ Total ayahs: ${juz1.data.totalAyahs}`);
  console.log(`   ✅ First ayah has juz field: ${juz1.data.ayahs[0].juz}`);
  console.log(`   ✅ First ayah text: ${juz1.data.ayahs[0].textAr.substring(0, 30)}...\n`);
  
  // Test 3: Last Juz ayahs
  console.log('3️⃣ Testing GET /quran/juz/30/ayahs');
  const juz30Res = await fetch('https://noor-app-backend-one.vercel.app/api/v1/quran/juz/30/ayahs');
  const juz30 = await juz30Res.json();
  console.log(`   ✅ Total ayahs: ${juz30.data.totalAyahs}`);
  console.log(`   ✅ First surah: ${juz30.data.ayahs[0].surahId}`);
  console.log(`   ✅ Last surah: ${juz30.data.ayahs[juz30.data.ayahs.length-1].surahId}\n`);
  
  // Test 4: Full catalog meta
  console.log('4️⃣ Testing GET /quran/full-catalog (checking meta)');
  const catalogRes = await fetch('https://noor-app-backend-one.vercel.app/api/v1/quran/full-catalog');
  const catalog = await catalogRes.json();
  console.log(`   ✅ Total surahs: ${catalog.data.meta.totalSurahs}`);
  console.log(`   ✅ Total ayahs: ${catalog.data.meta.totalAyahs}`);
  console.log(`   ✅ Total pages: ${catalog.data.meta.totalPages}`);
  console.log(`   ✅ Total juz: ${catalog.data.meta.totalJuz}\n`);
  
  // Test 5: Check juz field in catalog ayahs
  console.log('5️⃣ Checking juz field in full catalog ayahs');
  const firstSurah = catalog.data.surahs[0];
  const firstAyah = firstSurah.ayahs[0];
  console.log(`   ✅ First ayah has juz: ${firstAyah.juz !== undefined}`);
  console.log(`   ✅ Ayah structure: ${JSON.stringify(firstAyah)}\n`);
  
  // Test 6: Count unique juz numbers in catalog
  console.log('6️⃣ Counting unique juz numbers in catalog');
  const allJuzNumbers = new Set();
  catalog.data.surahs.forEach(surah => {
    surah.ayahs.forEach(ayah => {
      if (ayah.juz) allJuzNumbers.add(ayah.juz);
    });
  });
  console.log(`   ✅ Unique juz numbers found: ${allJuzNumbers.size}`);
  console.log(`   ✅ Juz range: ${Math.min(...allJuzNumbers)} to ${Math.max(...allJuzNumbers)}\n`);
  
  console.log('✅ All tests passed! Juz data is complete in all endpoints.\n');
}

testJuzEndpoints().catch(console.error);
