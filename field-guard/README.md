# FIELD GUARD

نظام إدارة حضور وانصراف عمال الملاعب.

## المعاينة
https://yoursmartsite-com.github.io/Salary-portal/field-guard/

## الربط الحالي
- Firebase project: `field-guard-4cbb8`
- Authentication: Email/Password
- Firestore database: `(default)` في `europe-west1`
- حساب المالك والمشرف العام ومدير الفريق يتم التحقق منهم من `admins/{uid}`.
- يكفي اعتماد المدير مرة واحدة بوضع `active: true` و`role: "manager"` في مستنده داخل `admins/{UID}`.
- مدير الفريق ينشئ حسابات العمال من داخل لوحة FIELD GUARD؛ ينشأ لكل عامل حساب دخول مستقل وملف `employees/{uid}` مع `managerUid` و`teamId` تلقائيًا، لذلك لا يحتاج العامل إلى اعتماد منفصل داخل `admins`.
- كل مدير يرى ويدير العمال والسجلات التابعة لفريقه فقط. العامل يرى ملفه وحركاته فقط.
- لوحة المشرف تقرأ سجلات العمال والحضور والجولات ومناطق العمل والإعدادات من Firestore.
- العامل يرى ملفه وسجل الحركات الذي يخص UID الخاص به فقط.
- سجلات الحضور والجولات ومناطق العمل تُحفظ سحابيًا من لوحة المشرف.

## إعداد مطلوب مرة واحدة في Firebase
من Authentication → Settings → Authorized domains أضف:
`yoursmartsite-com.github.io`

## هيكل Firestore
- `admins/{uid}`: صلاحيات `owner` أو `admin` أو `manager` وحقل `active`.
- `employees/{uid}`: بيانات العامل وحالة الحساب، مع `managerUid` و`teamId` لربطه بمديره.
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

## قواعد Firestore
ملف القواعد الجاهز موجود في `firestore.rules`. نشره على GitHub وحده لا يفعّل القواعد في Firebase.

لتفعيلها:
1. افتح Firebase Console للمشروع `field-guard-4cbb8`.
2. افتح Firestore Database ثم تبويب Rules.
3. استبدل القواعد الحالية بمحتوى الملف `field-guard/firestore.rules`.
4. اضغط Publish.

قبل النشر، تأكد أن مستند المالك موجود في `admins/{UID}` وبداخله:
- `active`: Boolean بقيمة `true`
- `role`: String بقيمة `owner`

المشرف العام يستخدم `role: "admin"` و`active: true`. مدير الفريق يستخدم `role: "manager"` و`active: true`، ويُنشأ له حساب Firebase Authentication أولاً ثم مستند `admins/{UID}` مرة واحدة من المالك. لا تضف العمال إلى `admins`؛ المدير ينشئ حساباتهم من لوحة العمال. لا تسمح القواعد بإنشاء حساب مالك أو مدير من واجهة التطبيق. بعد نشر القواعد اختبر دخول المدير، ثم إنشاء عامل جديد ودخوله، وتأكد أن المدير لا يرى عمال مدير آخر.
