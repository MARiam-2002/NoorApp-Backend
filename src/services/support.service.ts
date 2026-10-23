import { z } from 'zod';

const messageAr = 'مرحبًا، أحتاج مساعدة في تطبيق نور.';
const messageEn = 'Hello, I need help with the Noor app.';

/** Public configuration only. No user data, message storage or outbound messaging. */
export function getSupportInfo(config: NodeJS.ProcessEnv = process.env) {
  const input = config.SUPPORT_WHATSAPP_NUMBER ?? '';
  const digits = input.trim().replace(/[\s()+-]/g, '');
  const validPhone = /^[1-9]\d{7,14}$/.test(digits);
  const emailInput = (config.SUPPORT_EMAIL ?? '').trim();
  const validEmail = z.email().safeParse(emailInput).success;
  const email = validEmail ? emailInput : null;
  const whatsappLink = (message: string) => validPhone ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : null;
  const emailLink = (subject: string, body: string) => email
    ? `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` : null;
  return {
    schemaVersion: 1,
    titleAr: 'الدعم والتواصل', titleEn: 'Help & contact',
    responseMessageAr: 'ابعتلنا رسالتك، وهنرد عليك في أقرب وقت ممكن.',
    responseMessageEn: 'Send us your message and we will get back to you as soon as possible.',
    businessHours: null,
    whatsapp: {
      enabled: validPhone,
      phoneE164: validPhone ? `+${digits}` : null,
      displayPhone: validPhone ? `+${digits}` : null,
      url: validPhone ? `https://wa.me/${digits}` : null,
      urlAr: whatsappLink(messageAr), urlEn: whatsappLink(messageEn),
      labelAr: 'تواصل عبر واتساب', labelEn: 'Contact on WhatsApp',
    },
    email: {
      enabled: validEmail, address: email,
      urlAr: emailLink('دعم تطبيق نور', messageAr),
      urlEn: emailLink('Noor app support', messageEn),
      labelAr: 'راسلنا بالبريد الإلكتروني', labelEn: 'Email us',
    },
    privacyNoteAr: 'لا ترسل كلمة المرور أو رمز التحقق في رسائل الدعم.',
    privacyNoteEn: 'Do not include your password or verification code in support messages.',
    faqs: [
      { id: 'notification_sound', questionAr: 'صوت الإشعارات لا يعمل، ماذا أفعل؟', questionEn: 'Why can’t I hear notification sounds?',
        answerAr: 'راجع إعدادات الصوت داخل نور، وأذونات إشعارات التطبيق، ومستوى الصوت ووضع عدم الإزعاج في الهاتف. إذا استمرت المشكلة، أرسل لنا نوع الهاتف وإصدار التطبيق ووصف ما حدث.',
        answerEn: 'Check Noor’s sound settings, notification permissions, phone volume and Do Not Disturb. If the issue continues, tell us your phone model, app version and what happened.' },
      { id: 'prayer_location', questionAr: 'كيف أراجع مواقيت الصلاة؟', questionEn: 'How can I check my prayer times?',
        answerAr: 'راجع المدينة والموقع والمنطقة الزمنية وطريقة الحساب في إعدادات الصلاة. عند الإبلاغ عن اختلاف، اذكر المدينة والتاريخ واسم الصلاة والوقت الذي ظهر.',
        answerEn: 'Check the city, location, timezone and calculation method in prayer settings. When reporting a difference, include the city, date, prayer name and displayed time.' },
      { id: 'progress', questionAr: 'أنهيت الورد ولم يتحدث التقدم، ماذا أفعل؟', questionEn: 'I finished my reading or adhkar but progress has not updated.',
        answerAr: 'تأكد من اتصال الإنترنت وتسجيل الدخول إلى الحساب الصحيح، ثم حدّث الشاشة. إذا استمرت المشكلة، أرسل اسم القسم والوقت وصورة للعداد. لا تمسح بيانات التطبيق قبل التواصل معنا إذا كان لديك تقدم غير متزامن.',
        answerEn: 'Check your connection and that you are signed in to the correct account, then refresh the screen. If it persists, send the section name, time and a screenshot of the counter. Contact us before clearing app data if you have unsynced progress.' },
      { id: 'content_correction', questionAr: 'كيف أبلغ عن خطأ في المحتوى؟', questionEn: 'How do I report a content correction?',
        answerAr: 'أرسل اسم القسم والنص المقصود أو صورة واضحة، ومعه اسم السورة ورقم الآية إن كان البلاغ متعلقًا بالقرآن، لنراجع المصدر بدقة.',
        answerEn: 'Send the section name and the relevant text or a clear screenshot. For Quran reports, include the surah and ayah number so we can check the source accurately.' },
    ],
  };
}
