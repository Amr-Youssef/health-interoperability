# دليل التشغيل السريع الكامل — المنصة الوطنية للربط الصحي (v0.2.4)

> حُدّث بتاريخ 2026-09-13 ليعكس الواقع الحالي: PostgreSQL + ‏44 موديلاً‏ + 5 هجرات + ~155 endpoint + ‏6 أدوار‏. النسخة السابقة كانت تقتصر على وحدة المريض وتحمل مساراً خاطئاً (`/Users/amryoussef/...`) — أُصلح هنا.

## 1. المتطلبات

- Node.js v20+ — PostgreSQL (محلي عبر Docker أو سحابي)
- ملف `.env` يحوي على الأقل:
```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/saudi_health_db?schema=public"
JWT_SECRET="long-random-secret-64-chars-min"
ALLOWED_ORIGIN="http://localhost:3000"
PORT="3000"
MLLP_PORT="2575"
```

## 2. الإقلاع (5 دقائق)

```bash
npm install                  # postinstall يولّد Prisma Client
npx prisma migrate deploy    # تطبيق الهجرات الخمس
npx prisma db seed           # أدوار + منظمات + مستخدمون تجريبيون
npm run dev                  # REST :3000 + MLLP :2575
```

- اللوحة: http://localhost:3000 (غير المسجَّل يُوجَّه إلى `/auth/login.html`)
- فحص الصحة: `GET /fhir/metadata`
- Docker بديل: `docker-compose up -d --build`
- نشر Vercel: كل الحركة تُوجه إلى `api/index.ts` (انظر `vercel.json` + `vercel.env`)

## 3. الدخول والصلاحيات

```bash
# تسجيل الدخول (يُعيد JWT + يُثبّت cookie)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"admin","password":"YOUR_PASSWORD"}'

# بياناتي
curl http://localhost:3000/api/auth/me -H "Authorization: Bearer <JWT>"
```

الأدوار الستة: `SYS_ADMIN, MOH_ADMIN, MOH_AUDITOR, HOSPITAL_ADMIN, CLINICIAN, PATIENT` (~33 صلاحية: `ORG_MANAGE, AUDIT, ANALYTICS, PATIENT_*, CLINICAL_*, CLAIM, IMPORT, CONSENT, BREAK_GLASS, EXPORT, FHIR_*`). البذر في `prisma/seed.ts`.

## 4. أهم النوافذ (نبذة)

```
GET  /fhir/metadata                        # قدرات خادم FHIR
GET  /fhir/Patient/:id/$everything          # الملف الصحي الموحد
POST /api/pipeline/run                     # تشغيل خط التطبيع
POST /api/hospitals/onboard                # تسجيل منشأة ديناميكياً
POST /api/hospitals/:id/ingest             # ضخ حمولة لمنشأة
POST /api/hl7v2/ingest                     # استيعاب HL7 v2.5 (+MLLP على 2575)
POST /api/cds/evaluate-draft-prescription  # فحص وصفة تجريبية
GET  /api/analytics/population-health      # مؤشرات سكانية
GET  /api/analytics/weqaa/reportable-cases # ترصد وقاء
POST /api/security/break-glass             # وصول طارئ
GET  /api/security/audit-chain/verify      # تحقق سلسلة التدقيق (NCA)
GET  /.well-known/smart-configuration      # اكتشاف SMART on FHIR
```

الجدول الكامل: [`docs/SYSTEM_MAP.md`](./docs/SYSTEM_MAP.md).

## 5. وحدة البيانات المُبلغة ذاتياً (Patient-Reported)

الخلفية مكتملة 100% (9 جداول + ~31 endpoint تحت `/api/patients/me/*` + تسلسل FHIR R4 + تحقق `src/demo/verify-patient-health.ts`). الواجهة موجودة (`public/js/patient-self-reported.js`).

### إنشاء حساسية
```bash
curl -X POST http://localhost:3000/api/patients/me/allergies \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "allergenName": "Penicillin",
    "allergenCode": "70618",
    "allergenSystem": "http://snomed.info/sct",
    "reactionText": "Rash",
    "reactionSeverity": "MODERATE"
  }'
```

### عرض الحساسية
```bash
curl -X GET http://localhost:3000/api/patients/me/allergies \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### تحديث دواء
```bash
curl -X PATCH http://localhost:3000/api/patients/me/medications/MEDICATION_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dose": "1000mg",
    "frequency": "Once daily",
    "currentlyTaking": true
  }'
```

### الملف الصحي المركب
```bash
curl -X GET http://localhost:3000/api/patients/me/health-profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### حذف حساسية
```bash
curl -X DELETE http://localhost:3000/api/patients/me/allergies/ALLERGY_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 6. كل نقاط الوحدة

```
GET    /api/patients/me/profile
PATCH  /api/patients/me/profile
GET    /api/patients/me/allergies
POST   /api/patients/me/allergies
PATCH  /api/patients/me/allergies/:allergyId
DELETE /api/patients/me/allergies/:allergyId
GET    /api/patients/me/medications
POST   /api/patients/me/medications
PATCH  /api/patients/me/medications/:medicationId
DELETE /api/patients/me/medications/:medicationId
GET    /api/patients/me/conditions
POST   /api/patients/me/conditions
PATCH  /api/patients/me/conditions/:conditionId
DELETE /api/patients/me/conditions/:conditionId
GET    /api/patients/me/procedures
POST   /api/patients/me/procedures
PATCH  /api/patients/me/procedures/:procedureId
DELETE /api/patients/me/procedures/:procedureId
GET    /api/patients/me/family-history
POST   /api/patients/me/family-history
PATCH  /api/patients/me/family-history/:familyId
DELETE /api/patients/me/family-history/:familyId
GET    /api/patients/me/social-history
POST   /api/patients/me/social-history
GET    /api/patients/me/vitals?type=BLOOD_PRESSURE
POST   /api/patients/me/vitals
DELETE /api/patients/me/vitals/:vitalId
GET    /api/patients/me/documents?category=LAB_REPORT
POST   /api/patients/me/documents
DELETE /api/patients/me/documents/:documentId
GET    /api/patients/me/health-profile
```

## 7. المبادئ المطبقة في الوحدة

- كل سجل يحمل:
```json
{
  "source": "PATIENT",
  "verificationStatus": "UNVERIFIED",
  "recordedAt": "2026-08-30T21:00:00Z"
}
```
- بيانات المريض لا تصبح حقيقة سريرية تلقائياً — التحقق يتم عبر طابور `moh/verification-queue`.
- المرضى لا يصلون إلا لسجلاتهم (403 عند التجاوز) — الفحص في طبقة الخدمة `src/core/patient-reported-health-service.ts`.
- كل عملية تُسجل في سلسلة التدقيق المشفرة — لا تلفيق بيانات (الحقول الاختيارية تبقى `null`).
- تسلسل FHIR R4 عبر `src/fhir/patient-reported-health-fhir-serializer.ts` (‏6 مسلسلات‏).

## 8. المخطط والملفات

```
Patient (1) ──┬─→ (1) PatientProfile
              ├─→ (Many) PatientReportedAllergy
              ├─→ (Many) PatientReportedMedication
              ├─→ (Many) PatientReportedCondition
              ├─→ (Many) PatientReportedProcedure
              ├─→ (Many) FamilyMember
              ├─→ (1) PatientReportedSocialHistory
              ├─→ (Many) PatientReportedVitalObservation
              └─→ (Many) PatientUploadedDocument
```

| الملف | الدور |
|------|-------|
| `src/core/domain/patient-reported-health.ts` | واجهات TypeScript (‏14 نوعاً‏) |
| `src/core/patient-reported-health-service.ts` | منطق الأعمال (60+ دالة) |
| `src/api/routes/patient-reported-health-routes.ts` | REST API (~31 endpoint) |
| `src/fhir/patient-reported-health-fhir-serializer.ts` | تسلسل FHIR (6 دوال) |
| `src/demo/verify-patient-health.ts` | تحقق تكاملي (15 فحصاً) |
| `prisma/migrations/20260830180112_add_patient_reported_health_data/` | الهجرة |

## 9. الاختبار

```bash
npm test                                   # كامل Vitest (6 ملفات، ~32 اختباراً)
npm run build && node dist/demo/verify-patient-health.js   # تحقق الوحدة (15 فحصاً)
```

تغطية الوحدة: إنشاء مريض، حساسية (مصدر/حالة)، ثبات PostgreSQL، تفويض، تدقيق، أدوية، حالات، إجراءات، عائلة، اجتماعي، حيويات، وثائق، ملف مركب، ثبات بعد إعادة التشغيل، تسلسل FHIR.

## 10. استكشاف الأخطاء

1. **فشل الاختبارات المتصلة بالسحابة** (`too many connections`): أعد المحاولة لاحقاً أو استخدم `docker-compose.yml` محلياً.
2. **الخادم لا يقلع**: تأكد أن المنفذ 3000 حر، و`DATABASE_URL` صحيح (`npx prisma db push` للفحص)، و`JWT_SECRET` مضبوط.
3. **401/403**: تحقق من صلاحية JWT، وأن الدور مناسب (`Bearer <token>`)، وأن `ALLOWED_ORIGIN` يطابق الواجهة.
4. **المسار القديم** `/Users/amryoussef/health-interoperability` لم يعد مستخدماً — اعمل من جذر المستودع الحالي.

## 11. الخطوة التالية

الواجهة الأساسية للوحدة موجودة (`patient-self-reported.js`) — التوسع المقترح: لوحة مريض مرئية (حساسية/أدوية/حيويات برسوم)، رفع وثائق، وتصدير حزم FHIR.

---

**الحالة:** ✅ جاهز للنشر — **التحقق:** 15/15 للوحدة — **الامتثال:** FHIR R4 — **التحديث:** 2026-09-13
