صالة التحدي - ألعاب أونلاين على GitHub Pages
=============================================

الملفات:
- index.html: واجهة الموقع.
- style.css: التصميم.
- app.js: منطق الألعاب والاتصال بقاعدة البيانات.
- firebase-config.js: بيانات ربط Firebase.

طريقة النشر:
1) نزّل ZIP وفك الضغط.
2) افتح مستودع GitHub الخاص بالموقع.
3) ارفع الملفات إلى جذر المستودع (نفس مكان index.html).
4) افتح Settings > Pages، واختر Deploy from a branch ثم main و /(root).
5) افتح رابط GitHub Pages بعد اكتمال النشر.

تفعيل اللعب أونلاين:
1) افتح https://console.firebase.google.com وأنشئ مشروعًا.
2) أضف تطبيق Web واحفظ بيانات firebaseConfig.
3) من Authentication > Sign-in method فعّل Anonymous.
4) من Realtime Database أنشئ قاعدة بيانات.
5) انسخ إعدادات التطبيق إلى firebase-config.js.

مهم جدًا:
- ضع apiKey وauthDomain وdatabaseURL وprojectId وappId الحقيقية.
- لا تترك قاعدة البيانات مفتوحة بلا قواعد أمان.
- الكود الحالي واجهة بداية عملية، لكن قواعد Firebase يجب ضبطها واختبارها قبل إتاحتها للعامة.
- في Realtime Database > Rules استخدم قواعد تمنع الوصول غير المصرح به. لا تستخدم ".read": true و".write": true كحل دائم.
- راجع قواعد الأمان هنا: https://firebase.google.com/docs/database/security
- لم يتم تعديل مستودع GitHub تلقائيًا؛ ارفع الملفات بنفسك.
