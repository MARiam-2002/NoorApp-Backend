# 🔊 Salawat Audio Setup Guide

## المطلوب

صوت **"صلِّ على محمد"** للإشعارات التذكيرية.

---

## ✅ الحل السريع (يدوي)

### الخطوة 1: تحميل الملف

1. افتحي الرابط ده: https://freesound.org/people/ibrahim_baig/sounds/788917/
2. اضغطي على زر **"Download"** (قد تحتاجي تسجيل دخول مجاني)
3. احفظي الملف باسم: `salli_ala_muhammad.mp3`

### الخطوة 2: رفع الملف

ضعي الملف في المكان ده:
```
assets/salawat/salli_ala_muhammad.mp3
```

### الخطوة 3: التحقق

شغلي السيرفر محلياً واتأكدي إن الـ endpoint شغال:
```bash
curl http://localhost:3000/api/v1/salawat/audio
```

---

## 🎯 مواصفات الملف المطلوب

- **الاسم:** `salli_ala_muhammad.mp3`
- **المدة:** 2-5 ثواني (قصير للإشعارات)
- **المحتوى:** صوت بيقول "صلِّ على محمد" أو "اللهم صل على محمد"
- **الجودة:** أي جودة (يُفضل < 1 MB)
- **License:** CC0 أو Public Domain (عشان نقدر نستخدمه بحرية)

---

## 🔄 Fallback Behavior

**ملاحظة مهمة:** لو الملف مش موجود، الـ API **مش هيكسر**!

سيحدث التالي:
- الـ endpoint `/salawat/audio` هيرجع الـ clip بـ `available: false`
- الـ reminder service هيستخدم الصوت الاحتياطي: `meditation_bell.mp3`
- المستخدم هيقدر يختار من الأصوات المتاحة فقط

---

## 📱 للمستقبل: بدائل أخرى

إذا أردتِ إضافة أصوات أخرى لاحقاً:

### Freesound.org (CC0):
- https://freesound.org/search/?q=islamic+prayer
- https://freesound.org/search/?q=salawat

### كيفية الإضافة:
1. حملي الملف MP3
2. ضعيه في `assets/salawat/`
3. أضيفي entry جديد في `src/shared/constants/salawat-audio.ts`

---

## 🧪 اختبار

بعد إضافة الملف، جربي:

```bash
# Local
curl http://localhost:3000/api/v1/salawat/media/salli_ala_muhammad.mp3 -I

# Production (بعد الـ deploy)
curl https://noorapp-backend-production.up.railway.app/api/v1/salawat/media/salli_ala_muhammad.mp3 -I
```

**Expected:** `HTTP 200 OK` + `Content-Type: audio/mpeg`

---

## ⚠️ ملاحظات مهمة

1. **الملف لازم يكون MP3** (مش HTML أو text)
2. **الاسم لازم يطابق تماماً:** `salli_ala_muhammad.mp3`
3. **Git ignore:** الملفات الكبيرة (> 1MB) يُفضل عدم رفعها لـ git

---

## 🚀 Deployment

بعد إضافة الملف محلياً:

1. **Build:**
   ```bash
   npm run build
   ```

2. **Test locally:**
   ```bash
   npm start
   curl http://localhost:3000/api/v1/salawat/audio | jq '.data.clips[0]'
   ```

3. **Deploy to Railway:**
   - احفظي الملف في `assets/salawat/`
   - اعملي commit و push:
     ```bash
     git add assets/salawat/salli_ala_muhammad.mp3
     git commit -m "feat: add salli ala muhammad voice clip"
     git push origin main
     ```

4. **Railway auto-deploy:** سيتم رفع الملفات تلقائياً

---

## 🎉 النتيجة النهائية

بعد الإضافة، الـ API سيرجع:

```json
{
  "clips": [
    {
      "id": "salli_ala_muhammad_voice",
      "title": "Salli ala Muhammad (voice)",
      "titleAr": "صلِّ على محمد (صوت)",
      "audioUrl": "https://.../api/v1/salawat/media/salli_ala_muhammad.mp3",
      "available": true,
      "isDefault": true
    }
  ]
}
```

---

## 📞 دعم

لو واجهتك أي مشكلة، تأكدي من:
- ✅ الملف في المكان الصح
- ✅ الملف فعلاً MP3 (مش HTML)
- ✅ الاسم صحيح تماماً
- ✅ الـ build نجح بدون أخطاء
