"use strict";
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async function main() {
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
        AND column_name IN ('quranFontSize','quranReciter','quranTafsir','quranTranslation')
      ORDER BY ordinal_position;
    `);
    console.log("Found columns:\n" + JSON.stringify(rows, null, 2));
    if (Array.isArray(rows) && rows.length === 4) {
      console.log("\n✅ كل الأعمدة الأربعة موجودة في جدول users!");
    } else {
      console.log(
        "\n❌ ينقصنا أعمدة: " +
          (4 - (Array.isArray(rows) ? rows.length : 0)),
      );
    }
  } catch (err) {
    console.log("Query error:", err && err.message ? err.message : String(err));
  } finally {
    await prisma.$disconnect();
  }
})();
