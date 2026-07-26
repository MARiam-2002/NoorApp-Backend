# تعليمات إعداد Vercel - Vercel Setup Instructions

## الخطوات المطلوبة لتشغيل المشروع على Vercel

### 1️⃣ متطلبات البيئة

تأكد من وجود:
- ✅ حساب Vercel (vercel.com)
- ✅ مستودع GitHub مرتبط
- ✅ قاعدة بيانات PostgreSQL جاهزة

---

## 2️⃣ إعداد قاعدة البيانات

### Option A: استخدام Vercel Postgres (موصى به)

```bash
# تثبيت Vercel CLI
npm i -g vercel

# إنشاء قاعدة بيانات
vercel postgres create

# سحب متغيرات البيئة تلقائياً
vercel env pull
```

يحصل على `DATABASE_URL` تلقائياً ✅

### Option B: استخدام PostgreSQL خارجي

احصل على connection string من:
- Neon: https://neon.tech
- Railway: https://railway.app
- AWS RDS: https://aws.amazon.com/rds
- أو أي مزود آخر

---

## 3️⃣ توليد مفاتيح JWT قوية

**مهم جداً:** المفاتيح يجب أن تكون 32 حرف على الأقل!

```bash
# توليد JWT_SECRET
openssl rand -base64 32

# توليد JWT_REFRESH_SECRET
openssl rand -base64 32
```

**مثال للإخراج:**
```
aBcD1234efGH5678ijKL9012mnOP3456qrst=
xYzA9876bCdE5432fGhI1098jKlM7654nOpQ=
```

---

## 4️⃣ ضبط متغيرات البيئة في Vercel Dashboard

1. اذهب إلى [Vercel Dashboard](https://vercel.com/dashboard)
2. اختر المشروع (Noor App Backend)
3. اذهب إلى: **Settings → Environment Variables**
4. أضف المتغيرات التالية:

```
NODE_ENV                   = production
DATABASE_URL               = postgresql://...  (من الخطوة السابقة)
JWT_SECRET                 = (من openssl rand -base64 32)
JWT_REFRESH_SECRET         = (من openssl rand -base64 32)
CORS_ORIGIN                = https://your-frontend-domain.com
RATE_LIMIT_WINDOW_MS       = 900000
RATE_LIMIT_MAX             = 100
BCRYPT_SALT_ROUNDS         = 12
LOG_LEVEL                  = info
SWAGGER_ENABLED            = true
SWAGGER_TITLE              = Noor API
SWAGGER_DESCRIPTION        = Noor Islamic Lifestyle API
SWAGGER_VERSION            = 1.0.0
MAIL_ENABLED               = false
STORAGE_PROVIDER           = local
CACHE_PROVIDER             = memory
CACHE_DEFAULT_TTL_SECONDS  = 300
GOOGLE_CLIENT_ID           = (اختياري)
GOOGLE_CLIENT_SECRET       = (اختياري)
```

**خطوات الإضافة:**
1. اكتب الاسم (Key): `NODE_ENV`
2. اكتب القيمة (Value): `production`
3. اختر البيئات: Production, Preview, Development
4. اضغط "Save"
5. كرر لكل متغير

---

## 5️⃣ نشر الـ Branch

اضغط على branch في Vercel أو:

```bash
git push origin troubleshooting-support
```

سيقوم Vercel بـ:
1. تنزيل الكود من GitHub
2. تثبيت dependencies (`npm install`)
3. بناء المشروع (`npm run build`)
4. نشر على URL preview

---

## 6️⃣ التحقق من النشر

```bash
# الحصول على الرابط
curl https://your-project-abc123.vercel.app/api/v1/health

# يجب أن تحصل على:
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2024-07-26T15:30:00Z"
  }
}
```

---

## 7️⃣ نشر إلى Production

بعد التحقق من Preview:

### طريقة 1: عبر GitHub
```bash
# أنشئ Pull Request إلى main
# اختبر في Preview
# دمج (Merge) إلى main
# Vercel ينشر تلقائياً إلى Production
```

### طريقة 2: عبر Vercel CLI
```bash
vercel deploy --prod
```

---

## ⚠️ استكشاف الأخطاء

### Build fails
```bash
# تحقق من Vercel logs
vercel logs

# تأكد من البناء محلياً
npm run build

# تأكد من إضافة جميع المتغيرات
```

### Database connection error
```bash
# تحقق من DATABASE_URL
echo $DATABASE_URL

# اختبر الاتصال محلياً
npm run prisma:studio
```

### "Cannot find module" errors
```bash
# تأكد من Prisma client
npm run prisma:generate

# أعد تثبيت dependencies
rm -rf node_modules package-lock.json
npm install
```

### CORS errors
```bash
# تحقق من CORS_ORIGIN
# يجب أن يطابق رابط الـ Frontend
```

---

## 📊 المراقبة والـ Logs

```bash
# عرض Logs الـ Deployment
vercel logs

# عرض Logs التطبيق
vercel logs --tail

# عرض بيانات الـ Performance
vercel analytics
```

---

## 🔄 التحديثات المستقبلية

كل push إلى branch تلقائياً ينشر preview جديد:

```bash
git add .
git commit -m "feat: new feature"
git push origin troubleshooting-support
```

Vercel سينشر preview جديد خلال 1-2 دقيقة ✅

---

## 📝 Checklist قبل الإطلاق

- [ ] DATABASE_URL معيّن بشكل صحيح
- [ ] JWT_SECRET و JWT_REFRESH_SECRET أكثر من 32 حرف
- [ ] جميع المتغيرات المطلوبة موجودة
- [ ] Health endpoint يعمل (`/api/v1/health`)
- [ ] Swagger docs متاح (`/api/v1/docs`)
- [ ] CORS معيّن للـ Frontend
- [ ] Build يعمل بدون أخطاء
- [ ] لا توجد secrets مكشوفة في logs

---

## 🆘 دعم إضافي

- [Vercel Docs](https://vercel.com/docs)
- [Express on Vercel](https://vercel.com/docs/functions/serverless-functions/languages/node-js)
- [Vercel PostgreSQL](https://vercel.com/docs/storage/vercel-postgres)
- [Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Troubleshooting](https://vercel.com/docs/help)

---

**تم! المشروع الآن جاهز للنشر على Vercel** 🚀
