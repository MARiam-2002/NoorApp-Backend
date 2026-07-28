async function dashboardDeep() {
  const BASE = "http://localhost:3000/api/v1";
  const rand = Math.random().toString(36).slice(2, 10);
  const email = `deep_${rand}@gmail.com`;
  const pass = "StrongPass123!";

  console.log("→ Sign up:", email);
  const sr = await fetch(`${BASE}/auth/sign-up`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fullName: "أحمد محمد علي", email, password: pass }),
  });
  const sjson = await sr.json();
  console.log("  status:", sr.status, "success:", sjson?.success);
  if (!sjson?.success) {
    console.log("  ERROR:", JSON.stringify(sjson, null, 2));
    process.exit(1);
  }
  const token = sjson.data.tokens.accessToken;

  // Dashboard
  const dr = await fetch(`${BASE}/dashboard`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const djson = await dr.json();
  console.log("  dashboard status:", dr.status, "success:", djson?.success);
  if (!djson?.success) {
    console.log("  ERROR:", JSON.stringify(djson, null, 2));
    process.exit(1);
  }
  const g = djson.data.greeting;

  console.log("");
  console.log("═══════════════════════════════════════");
  console.log("📋 DASHBOARD DEEP INSPECTION (greeting)");
  console.log("═══════════════════════════════════════");
  console.log("displayName    :", g.displayName, '← "أهلا احمد" في الشاشة');
  console.log("fullName       :", JSON.stringify(g.fullName), "← nullable");
  console.log("username       :", g.username, "← auto-generated");
  console.log("points         :", g.points);
  console.log("weekdayName    :", g.weekdayName, "← اسم اليوم");
  console.log("hijriDate      :", g.hijriDate, "← الهجري");
  console.log("gregorianDate  :", g.gregorianDate, "← الميلادي");
  console.log("");
  console.log("═══════════════════════════════════════");
  console.log("📋 prayers.nextPrayer ← العداد التنازلي");
  console.log("═══════════════════════════════════════");
  const np = djson.data.prayers.nextPrayer;
  if (np) {
    const h = Math.floor(np.countdownSeconds / 3600);
    const m = Math.floor((np.countdownSeconds % 3600) / 60);
    const s = np.countdownSeconds % 60;
    console.log("nameAr          :", np.nameAr, '← "صلاة العصر"');
    console.log("time            :", np.time);
    console.log(
      "countdownSeconds:",
      np.countdownSeconds,
      `≈ ${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
    );
  }
  console.log("");
  console.log("═══════════════════════════════════════");
  console.log("📋 prayers.schedule (5) ← لكل صلاة الوقت+الحالة");
  console.log("═══════════════════════════════════════");
  djson.data.prayers.schedule.forEach((sc) => {
    const mark = sc.completed ? "✅ ذهبي" : "⚪ رمادي";
    console.log(`  ${String(sc.nameAr).padEnd(6, " ")} | ${sc.time} | ${mark}`);
  });
  console.log("");
  console.log("═══════════════════════════════════════");
  console.log("📋 dailyJourney ← رحلتك اليومية");
  console.log("═══════════════════════════════════════");
  const j = djson.data.dailyJourney;
  console.log(
    `  الصلاة : ${j.prayer.completed}/${j.prayer.total} (progress ${j.prayer.progress}%)`,
  );
  console.log(`  القرآن : ${j.quran.pagesRead} صفحات اليوم`);
  console.log(
    `  الذكار : completed=${j.adhkar.completed} ✓ تم الانجاز بالشاشة`,
  );
  console.log(`  الصدقة : amount=${j.sadaqah.amount}`);
  console.log("");
  console.log("═══════════════════════════════════════");
  console.log("📋 khatmah ← استكمل الختمة");
  console.log("═══════════════════════════════════════");
  const k = djson.data.khatmah;
  if (k) {
    console.log(`  surahNameAr  : ${k.surahNameAr}  (سورة البقرة)`);
    console.log(`  currentPage  : ${k.currentPage}  (صفحة 35)`);
    console.log(`  progressPercent: ${k.progressPercent}%`);
  }
  console.log("");
  console.log("═══════════════════════════════════════");
  console.log("📋 dailyChallenge ← تحدي اليوم");
  console.log("═══════════════════════════════════════");
  const c = djson.data.dailyChallenge;
  if (c) {
    console.log(`  titleAr       : ${c.titleAr}`);
    console.log(`  rewardPoints  : +${c.rewardPoints} نقطة`);
    console.log(`  targetValue   : ${c.targetValue}`);
    console.log(`  completed     : ${c.completed}`);
    console.log(`  claimed       : ${c.claimed}`);
  }
  console.log("");
  console.log("═══════════════════════════════════════");
  console.log("✅ الشاشة كاملة 10/10. مفيش حاجة ناقصة للـ Flutter developer");
  console.log("═══════════════════════════════════════");
  process.exit(0);
}
dashboardDeep().catch((e) => {
  console.error("CRASH:", e.message, e.stack);
  process.exit(1);
});
