# خريطة النظام الحالية — Saudi Health Interoperability Platform (v0.2.4)

> **تاريخ المسح:** 2026-09-13 — **المنهج:** قراءة فعلية للكود (`src/` ‏92 ملفاً‏، `prisma/schema.prisma` ‏44 موديلاً‏، `server.ts` نقاط التركيب، `tests/` ‏6 ملفات‏) + بناء `tsc --noEmit` نظيف.
> **الهدف:** مرجع واحد يجيب «أين يقع ماذا؟» ويكشف أي اختلاط توثيقي مستقبلاً. عند أي تغيير معماري، حدّث هذا الملف أولاً.

## 1. نظرة جوية

```
المصادر (مستشفيات A/B/C + ديناميكية + HL7 MLLP :2575 + ملفات CSV/JSON)
  → المحولات src/ingestion/{adapters,dynamic,hl7v2} → المخزن الخام PrismaRawStore (SHA-256, غير متلف)
  → محرك التطبيع src/orchestration/normalization-engine.ts (validate→map→terminology→MPI→persist→provenance)
  → المخزن الكنسي PrismaCanonicalStore + MPI + Terminology + Provenance (PostgreSQL — 44 موديلاً)
  → الطبقات: FHIR R4 (/fhir) + SMART (/oauth) + REST (/api) + واجهة public/ + NPHIES/CDS/تحليلات/تدقيق
```

- **النمط:** Express monolith معياري — `createPlatformApp()` في `src/api/server.ts` يحقن الخدمات في كل الوحدات. النشر المزدوج: Docker محلي (`Dockerfile` + `docker-compose.yml`) وVercel لاخادمي (`api/index.ts` + `vercel.json`).
- **البوابات:** REST `:3000` + MLLP TCP `:2575` + مهلة إقلاع Vercel ‏2500ms‏.
- **الأمان:** helmet (CSP+nonce/HSTS) + CORS (`ALLOWED_ORIGIN` إلزامي إنتاجاً) + JSON ‏50mb‏ + rate-limit (auth ‏20/15m‏، login ‏10/15m‏، SMART ‏30/15m‏) + JWT (header+cookie) + RBAC ‏6 أدوار × ~33 صلاحية‏ + سلسلة تدقيق تجزئة (`AuditBlock`) + break-glass.

## 2. شجرة المجلدات (فعلية)

```
src/ (92 ملفاً)
├── api/server.ts                    # createPlatformApp — التجميع والـ middlewares والتركيب
├── api/routes/ (7)                  # auth, hospital(18), moh(20), patient(4), appointments(5), corrections(3), patient-reported-health(~31)
├── modules/ (16)                    # admin, analytics, audit, cds, clinical, clinical-write, data, fhir, hl7, hospital, nphies, patients, platform, public, security, smart
├── core/domain/ (21)                # patient, encounter, condition, observation, medication, allergy-intolerance, diagnostic-report, immunization, practitioner, organization, financial, provenance, mpi-identity, patient-identifier, raw-record, mapping-config, longitudinal-record, patient-reported-health, types, index
├── core/patient-reported-health-service.ts
├── ingestion/{adapters, dynamic/dynamic-adapter.ts, hl7v2/{hl7-parser,hl7-adapter,mllp-server}, raw-store/{interface,memory,sqlite,prisma}}
├── mapping/{engine/{mapping-engine,fhir-resource-mapper}, config/mapping-registry, transformation/transform-engine}
├── mpi/{mpi-service, prisma-mpi-service}
├── terminology/{terminology-service, prisma-terminology-service}
├── provenance/{provenance-service, prisma-provenance-service}
├── persistence/{canonical-store(.interface), prisma-canonical-store}
├── fhir/{fhir-serializer, patient-reported-health-fhir-serializer}
├── orchestration/normalization-engine.ts   # ~1466 سطر — قلب المنصة
├── validation/validation-engine.ts
├── security/ (6)                    # smart-auth, consent-manager, authorize, authorization.service, auth-middleware, audit-chain
├── cds/cds-engine.ts
├── analytics/{population-health, weqaa-surveillance}
├── integration/nphies/nphies-sandbox.ts
├── export/bulk-export.ts
├── patient/{patient.service, patient-identity}
├── benchmark/benchmark-runner.ts
├── demo/{run-demo, verify-patient-health, mutation-test, final-verification-test}
├── lib/prisma.ts                    # singleton العميل
└── config/jwt.ts                    # أسرار JWT الموحدة
api/index.ts                         # مدخل Vercel (5 أسطر → createPlatformApp)
prisma/ (8 ملفات)                    # schema.prisma (44 موديلاً) + seed.ts (341 سطراً) + 5 هجرات
tests/ (6 ملفات)                     # unit/{normalization-pipeline, baseline-security(10), hl7-mllp-server, real-raw-store} + patient-reported-health{,-integration}
scripts/ (4)                         # test_search_org, p6-fill-uuids, check_pat_org2, check_clinician_org
public/ (10)                         # index.html/app.js/style.css + js/{api-client,patient-self-reported} + data/terminology.json + auth/{login,register}.html + auth.{js,css}
```

## 3. قاعدة البيانات (44 موديلاً + 5 هجرات)

| المجموعة | الموديلات |
|---|---|
| هوية وصلاحيات | `User, Organization, Role, RolePermission, UserPermission` — أدوار: SYS_ADMIN/MOH_ADMIN/MOH_AUDITOR/HOSPITAL_ADMIN/CLINICIAN/PATIENT |
| سريري canonical | `Patient(+internal_id_uuid), PatientIdentifier, PatientOrganization, Encounter, Condition, Observation, MedicationRequest, Immunization, Coverage, Claim, ClaimResponse, AllergyIntolerance, DiagnosticReport` — كلها `correction_status` |
| مواعيد وموافقة | `Appointment ↔ Consent (1-1)` |
| تدقيق | `AuditLog, AuditBlock (سلسلة تجزئة), DataImport` |
| خط الأنابيب | `RawRecord, InternalPatientIdentity, MpiIdentifier, MatchHistory, DuplicateCandidate, TerminologyConcept, TerminologyCoding, TerminologyMapping, ProvenanceRecord, SmartToken, DynamicHospital, OrganizationChangeRequest` |
| مُبلغ ذاتياً (9) | `PatientProfile, PatientReportedAllergy/Medication/Condition/Procedure, FamilyMember, PatientReportedSocialHistory, PatientReportedVitalObservation, PatientUploadedDocument` |

الهجرات: `20260830133138_init` → `20260830180112_add_patient_reported_health_data` → `20260903000000_rbac_hardening` → `20260904000000_appointment_consent_quad` → `20260904000001_correction_status`.

## 4. جدول الـ endpoints (~155)

### 4.1 نواة server.ts
| المسار | الوصف |
|---|---|
| `GET /`, `/index.html` | اللوحة (JWT→redirect للـ login) |
| `GET /api/hospitals` + `POST /api/hospitals/onboard` + `POST /api/hospitals/:id/ingest` + `POST /api/ingest/file` | التسجيل والضخ (تكرار توافقي في `modules/hospital`) |

### 4.2 المسارات القديمة src/api/routes/
| البادئة | Endpoints |
|---|---|
| `/api/auth` (4) | `POST /register|login|logout`, `GET /me` |
| `/api/hospital` (18) | `GET /me`, `PATCH /me`, `GET /me/stats`, `GET /global-patients|patients`, `GET /patients/:id/longitudinal`, `GET /me/change-requests`, `GET /imports|info`, `POST /patients|encounters`, `GET+POST /users`, `PATCH /users/:id/status|role`, `PATCH /users/:id`, `POST /users/:id/reset-password`, `GET /users/:id` |
| `/api/moh` (20) | `GET /dashboard|hospitals|users|organization-changes|patients|patients/:id/longitudinal|verification-queue|audit|mpi/duplicates`, `POST /hospitals/:id/approve|reject|suspend`, `POST /users/create-admin|create`, `PATCH /users/:id/status|role`, `POST /organization-changes/:id/approve|reject`, `POST /verification/:type/:id/verify`, `PATCH /patients/:id/identity` |
| `/api/patient` (4) | `GET /me`, `PATCH /me`, `GET /my-record`, `POST /consent` |
| `/api/appointments` (5) | `POST /`, `GET /my|organization|:id`, `PATCH /:id/status` |
| `/api/corrections` (3) | `POST /:type/:id/request|approve`, `GET /pending` |
| `/api/patients` (~31) | `GET+PATCH /me/profile`, CRUD `/me/allergies|medications|conditions|procedures|family-history` (×4)، `GET+POST /me/social-history`, `GET+POST+DELETE /me/vitals`, `GET+POST+DELETE /me/documents`, `GET /me/health-profile` |

### 4.3 الوحدات src/modules/
| الوحدة | البادئة | Endpoints |
|---|---|---|
| fhir | `/fhir` | `GET /metadata|$export|Patient/$export|Patient|Patient/:id|Patient/:id/$everything|ClaimResponse|Consent`, `POST /:type/$validate`, `GET /[Encounter|Condition|Observation|MedicationRequest|Immunization|AllergyIntolerance|DiagnosticReport|Coverage|Claim]` |
| smart | `/` | `GET /.well-known/smart-configuration`, `POST /oauth/token|introspect` |
| platform | `/api` | `POST /pipeline/run`, `GET /monitoring/stats` |
| nphies | `/api` | `GET /nphies/financial-summary`, `POST /nphies/eligibility/:patientId` |
| cds | `/api` | `GET /cds/patient/:id/safety-alerts`, `POST /cds/evaluate-draft-prescription` |
| analytics | `/api` | `GET /analytics/population-health|weqaa/reportable-cases|weqaa/bundle/:caseId`, `POST /analytics/weqaa/dispatch/:caseId` |
| security | `/api` | `GET /security/consent/:patientId|break-glass/logs|audit-chain|audit-chain/verify`, `POST /security/break-glass` |
| data | `/api` | `GET /raw-store|mpi/identities|mpi/duplicate-candidates|terminology/concepts|mappings|provenance`, `POST /raw-store/:id/reprocess|mpi/merge|unmerge` |
| patients | `/api` | `GET /patients/search|patients|patients/:id/longitudinal` |
| hospital | `/api` | (توافق: نفس 4 نواة التسجيل/الضخ) |
| public | `/api` | `GET /public/organizations|clinicians` |
| hl7 | `/api` | `POST /hl7v2/ingest` (+MLLP TCP ‏2575‏) |
| clinical | `/api` | `GET /medications|immunizations` |
| clinical-write | `/api/clinical` | `POST /encounter|condition|observation|diagnostic-report|allergy|immunization|medication` |
| admin | `/api` | `POST /admin/reset-data` |
| audit | `/api` | `GET /audit/integration-overview|connectors|records|records/:id/trace|evidence/:id` |

## 5. خريطة الأدوار → أهم الصلاحيات

| الدور | النطاق النموذجي |
|---|---|
| SYS_ADMIN | كل شيء (إدارة منظمات/مستخدمين، reset-data، حوكمة) |
| MOH_ADMIN | اعتماد المستشفيات، مراجعة تغييرات المنظمات، طابور التحقق، دمج MPI |
| MOH_AUDITOR | قراءة تدقيق/سجلات طولية بحدود موسعة + إحصاءات مراقبة (بلا منتقي شامل) |
| HOSPITAL_ADMIN | مساحة المستشفى (ملف/إحصاءات/مستخدمون/استيرادات/ضخ) |
| CLINICIAN | قراءة/كتابة سريرية (`CLINICAL_*`, `FHIR_READ_*`) + CDS + مواعيد المنظمة |
| PATIENT | سجله فقط (`/api/patient/*` + `/api/patients/me/*` + مواعيده + موافقته) |

التفاصيل: `prisma/seed.ts` (البذر) + `src/security/authorization.service.ts` (الإنفاذ).

## 6. سجل الاختلاطات المصححة (2026-09-13)

| # | الاختلاط | الواقع | الإصلاح |
|---|---|---|---|
| 1 | README: اختبارات «12/12» | 6 ملفات / ~32 اختباراً | أُعيدت كتابة قسم الاختبارات + ملاحظة حد الاتصالات |
| 2 | README: لا ذكر للـ DB/الهجرات/الأدوار | Postgres + 44 موديلاً + 5 هجرات + 6×~33 | أُضيف قسم الخريطة + إعداد `.env` |
| 3 | QUICK_START: مسار `/Users/amryoussef/...` + وحدة المريض فقط | المنصة الكاملة من الجذر الحالي | أُعيدت كتابته (منصة + وحدة) |
| 4 | PROJECT_STATUS: «الواجهة لم تبدأ» | `public/` ‏10 ملفات‏ כולל بوابة المريض | صُحّح + أُضيف قسم المنصة |
| 5 | WALKTHROUGH/task: تتوقف عند المرحلة 7/6 | 11 مرحلة فعلية | أُضيفت المراحل 8-11 |
| 6 | IMPLEMENTATION_PLAN: بنود MVP-Plus «مؤجلة» | كلها منفذة عدا DICOM/IHE/SHDD الكامل | جدول حالة التنفيذ |
| 7 | REFACTOR_PROGRESS: متوقف 2026-09-07 + 4 بنود «متبقية» | AuditBlock منفذ + 16 وحدة مستخرجة؛ متبقٍّ جزئيان (ترحيل UUID الكامل، فحص inline) | حُدّث بالجدول |
| 8 | BEST_PRACTICES: بلا مراجع ملفات + «6×31» | مراجع `src/` الفعلية + ~33 صلاحية | أُضيفت المراجع |
| 9 | لا توجد خريطة نظام | — | هذا الملف (جديد) |
| 10 | عدد endpoints الوحدة «35» | الفعلي 31 في `patient-reported-health-routes.ts` | صُحّح في PROJECT_STATUS/QUICK_START |

## 7. كيف تحافظ على التوثيق متزامناً

1. أي وحدة/مسار/هجرة جديدة → حدّث هذا الملف (§2-§4) + سطراً في `README.md` (§خريطة النظام).
2. أي مرحلة منجزة → سطر في `task.md` + قسم في `WALKTHROUGH.md`.
3. أي ترحيل هوية/أمني → `docs/REFACTOR_PROGRESS.md` + `docs/migration/`.
4. فحص سريع قبل الـ commit: `npx tsc --noEmit` + `grep` أعداد (`^model ` في schema، `router.` في routes، `app.use` في server.ts) ومطابقتها مع §3-§4 أعلاه.
