const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MORNING_ITEMS = [
  {
    id: 'fb-m-1',
    orderInCategory: 1,
    textAr: 'أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ. اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ',
    repeatCount: 1,
    referenceAr: 'آية الكرسي - البقرة:255',
  },
  {
    id: 'fb-m-2',
    orderInCategory: 2,
    textAr: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ',
    repeatCount: 3,
    referenceAr: 'المعوذات',
  },
];

async function main() {
  console.log('Seeding adhkar data only...');
  
  // Create MORNING category
  const category = await prisma.dhikrCategory.upsert({
    where: { key: 'MORNING' },
    update: {},
    create: {
      id: 'cat-morning',
      key: 'MORNING',
      nameAr: 'اذكار الصباح',
      nameEn: 'Morning Adhkar',
      iconCode: '🌤️',
      sortOrder: 1,
      totalItems: MORNING_ITEMS.length,
    },
  });
  
  console.log('✅ Category created:', category.key);
  
  // Create items
  for (const item of MORNING_ITEMS) {
    await prisma.dhikrItem.upsert({
      where: { id: item.id },
      update: {},
      create: {
        ...item,
        categoryId: category.id,
      },
    });
    console.log('✅ Item created:', item.id);
  }
  
  console.log('\\n🎉 Adhkar seeding complete!');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
