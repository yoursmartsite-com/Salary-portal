# عطور رهف — تكامل OMNIX على GitHub

## التطبيق المسجل

- OMNIX program ID: `rahaf-perfume-store`
- تطبيق رهف: https://yoursmartsite-com.github.io/Salary-portal/rahaf-app/
- مركز التحكم: https://yoursmartsite-com.github.io/Salary-portal/omnix/
- واجهة OMNIX API: https://omnix-api.fibrahem865.workers.dev
- حساب المالك: `fibrahem865@gmail.com`

## مسار الاشتراك

1. المالك ينشئ اشتراكًا من قسم «الاشتراكات» في OMNIX ويختار برنامج «عطور رهف».
2. خادم OMNIX يصدر كودًا عشوائيًا بصيغة `RAH-XXXXXX-XXXXXX`.
3. الخادم يحفظ الاشتراك في `omnix/subscriptions/{uid}` وفهرس الكود في `omnix/activationCodes/{code}`.
4. تطبيق رهف يرسل الكود إلى `POST /api/rahaf/validate` ويتحقق من البرنامج والحالة وتاريخ البداية والانتهاء.
5. الأكواد الموقوفة أو المنتهية أو غير الصحيحة أو التابعة لبرنامج آخر تُرفض.

## الحالة

- [x] برنامج رهف مسجل في كتالوج OMNIX بمعرّف ثابت `rahaf-perfume-store`.
- [x] خادم OMNIX يصدر الأكواد ويحفظ فهرسها.
- [x] خادم OMNIX يوفر نقطة تحقق عامة للقراءة فقط `POST /api/rahaf/validate`.
- [x] واجهة تطبيق رهف تستخدم نفس نقطة التحقق.
- [x] صيغة الكود المعروضة في شاشة رهف مطابقة للصيغة التي يصدرها OMNIX.
- [x] رابط البرنامج يشير إلى نسخة GitHub Pages، ولا يعتمد على AppDeploy.

**مهم:** إنشاء الاشتراك وتجديده يتم من OMNIX فقط. إذا لم يظهر كود بعد الحفظ، يجب أن تظهر رسالة خطأ من API بدل اعتبار الاشتراك محفوظًا بنجاح.
