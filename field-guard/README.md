# FIELD GUARD

نظام إدارة حضور وانصراف عمال الملاعب.

## المعاينة
https://yoursmartsite-com.github.io/Salary-portal/field-guard/

## الربط الحالي
- Firebase project: `field-guard-4cbb8`
- Authentication: Email/Password
- Firestore database: `(default)` في `europe-west1`
- حسابات المشرفين والمالك يتم التحقق منها من `admins/{uid}`.
- حسابات العمال يتم التحقق منها من `employees/{uid}`.
- إضافة العامل من لوحة المشرف تنشئ حساب Firebase Auth منفصلًا ثم تحفظ ملفه في Firestore.
- لوحة المشرف تقرأ سجلات العمال والحضور والجولات ومناطق العمل والإعدادات من Firestore.
- العامل يرى ملفه وسجل الحركات الذي يخص UID الخاص به فقط.
- سجلات الحضور والجولات ومناطق العمل تُحفظ سحابيًا من لوحة المشرف.

## إعداد مطلوب مرة واحدة في Firebase
من Authentication → Settings → Authorized domains أضف:
`yoursmartsite-com.github.io`

## هيكل Firestore
- `admins/{uid}`: صلاحيات `owner` أو `admin` وحقل `active`.
- `employees/{uid}`: بيانات العامل وحالة الحساب.
- `attendance/{recordId}`: الحركات، مع `employeeId` و`type` و`timeLabel`.
- `inspection_rounds/{roundId}`: جولات التفتيش.
- `work_areas/{areaId}`: مناطق العمل.
- `settings/club`: إعدادات النادي.

## حدود التشغيل الحالية
- حسابات الدخول وربط بيانات لوحة المشرف مع Firestore مفعّلان في الواجهة.
- العامل يستطيع الدخول وعرض ملفه وحركاته فقط.
- تسجيل الحضور من حساب العامل لم يُفعّل بعد؛ قواعد Firestore الحالية تمنع العامل من إنشاء أو تعديل سجلات الحضور. هذا مقصود لحماية السجل من التلاعب.
- التحقق الحقيقي من GPS داخل حدود النادي، والصورة الحية، وجولات التفتيش المرسلة لهواتف العمال، والإشعارات، وتسجيل وقت موثوق من الخادم تحتاج طبقة خادم موثوقة واختبارات ميدانية.
- لا تعتمد النظام كسجل دوام رسمي قبل إكمال هذه الوظائف واختبارها.

## ملاحظة أمان
لا تضع Service Account private key في الواجهة أو GitHub. إعداد Firebase Web config الموجود في الواجهة مخصص للعميل، والحماية تعتمد على Authentication وFirestore Security Rules.
