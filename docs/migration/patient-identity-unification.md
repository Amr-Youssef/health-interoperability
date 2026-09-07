# خطة ترحيل الهوية السيادية — Patient.id vs internal_id vs NID
> **الحالة: خطة فقط — لا يُنفذ دون موافقة واختبار**

## الوضع الحالي (موثق في src/patient/patient-identity.ts)
- `Patient.id` (UUID PK): المفتاح البديل الحقيقي، مستخدم كـ FK في 11 جدول: PatientIdentifier, PatientProfile, PatientReported*, PatientOrganization
- `Patient.internal_id` (UNIQUE): حاليا = NID (10 أرقام) — يسرب الهوية، يمنع التدوير، مستخدم كـ FK في 14 جدول سريري: Encounter, Condition, Observation, MedicationRequest, Immunization, Coverage, Claim, AllergyIntolerance, DiagnosticReport, Consent, Appointment
- `PatientIdentifier.value` (NID/IQAMA/MRN): الهوية الوطنية الحقيقية — يجب أن تكون المصدر الوحيد للعرض

## الهدف
- `Patient.id` يبقى PK لكل العلاقات
- `Patient.internal_id` يصبح UUID معتم (opaque) لا يكشف NID، يُستخدم فقط كـ FHIR Patient.id بعد إخفاء
- `PatientIdentifier` هو الوحيد الذي يحمل NID، مع إخفاء (masking) في الواجهات العادية

## خطوات الترحيل (مُقسمة)
1. **إضافة عمود مؤقت** `internal_id_new` UUID + ملء بقيم `gen_random_uuid()` لكل سطر حيث `internal_id ~ '^(1|2)\d{9}$'`
2. **إضافة `@@unique([source_system_id, source_record_id])`** لكل جدول كنسي في prisma/schema.prisma (لمنع التكرار بعد الترحيل)
3. **إضافة أعمدة `patient_id_new` UUID** في 14 جدول سريري، وملء عبر `UPDATE ... FROM Patient WHERE old_internal = Patient.internal_id`
4. **اختبار تكافؤ** عبر سكربت يتحقق: كل Encounter/Condition يجد Patient عبر `patient_id_new = Patient.id` وأن FHIR serializer يقرأ masked identifier
5. **تبديل الأعمدة** في نافذة صيانة: DROP القديم + RENAME الجديد + إضافة FK `REFERENCES Patient(id)` + إعادة بناء index
6. **إخفاء NID** في `GET /api/patient/me` و `FHIR Patient.identifier` (عرض `1XXXXX5566` إلا لـ PATIENT_READ_ALL/BREAK_GLASS)

## المخاطر وكيفية التخفيف
- فقدان رابط سريري: الترحيل داخل transaction واحدة + نسخ احتياطي + سكربت تحقق قبل COMMIT
- كسر FHIR URLs الخارجية: الإبقاء على redirect مؤقت `NID → UUID` لمدة 30 يوم + توثيق
- أداء البحث: إضافة `GIN` و `@index([internal_id])` بعد التحويل

## Definition of Done
- `grep "references: \[internal_id\]" prisma/schema.prisma` = 0
- `GET /fhir/Patient/1XXXXX5566` لا يعمل، `GET /fhir/Patient/<uuid>` يعمل مع identifier masked
- كل اختبار `reassignPatientRecords` يشمل 20 جدول داخل transaction
