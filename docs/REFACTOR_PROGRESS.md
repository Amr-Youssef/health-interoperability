# تقدم إعادة الهيكلة التدريجية — المراحل 0-11 (حتى 2026-09-13)

> تحديث 2026-09-13: النسخة السابقة توقفت عند 2026-09-07 (P0-P9 + 4 بنود متبقية). أدناه الحالة الراهنة بعد التحقق من الكود الفعلي.

## المنجز (P0-P9 — كما كان + التثبيت)
- **P0 Hygiene**: `lib/prisma` singleton 31→1 + `config/jwt` موحد + `CORS ALLOWED_ORIGIN` + `rate-limit` مربوط بـ NODE_ENV + `JWT_EXPIRES_IN` + `baseline-security 10/10`
- **P1 Composition**: `server.ts` إزالة 10× `new PrismaClient` داخل handlers + تنظيف imports
- **P2 Auth**: `AuthorizationService` (Identity→EffectivePermissions→OrgScope→ResourceScope) + `rbac-guard` موسوم deprecated
- **P3 Patient**: `patient/patient-identity.ts` + `patient.service.ts` (whitelist 13 + validation + audit) + `patient-routes` رفيعة + `Prisma` موحد
- **P4 RawStore**: `PrismaRawStore.saveBatch` composite unique + `findBySource` insensitive + `memory/sqlite` موسومة TEST ONLY + UNIQUE في sqlite
- **P5 Domain**: `core/domain/longitudinal-record.ts` فصل + `mapping/engine/fhir-resource-mapper.ts` فصل + `fhir-serializer` لا يعتمد على persistence
- **P5 Persistence**: `persistence/canonical-store.interface.ts` + `ICanonicalStore` يطبقها JSON و Prisma
- **P6 Plan**: `docs/migration/patient-identity-unification.md` — خطة ترحيل `internal_id=NID→UUID` دون تنفيذ
- **P7 FHIR**: `modules/fhir/fhir.routes.ts` استخراج 13 مسار + حماية `/medications|immunizations|patients/*` بـ `verifyToken+requirePermission`
- **P7 Security**: `SMART` rate-limit 30/15m + `client_secret` + `scope` whitelist + `try/catch`
- **P8 Consent/Audit**: `consent baseline OPT_IN_FULL→EXPLICIT_PER_ENCOUNTER` + `AuditChain` تصفية CHAIN_ACTIONS + إزالة تجاوز broken + `clearAll` محدد
- **P9 Legacy**: تنظيف `.data/*.db*` (7 ملفات) + `migration-runner` موسع + وسم `CanonicalStore|NationalHealthDB|schema` deprecated

## التحديث 2026-09-13 — حالة البنود الأربعة المتبقية
| البند المتبقي (2026-09-07) | الحالة الآن | الدليل |
|---|---|---|
| تنفيذ هجرة `Patient.id` (20 جدول) — نافذة صيانة + اختبار تكافؤ | 🔶 جزئي: عمود `patient_id_uuid` حي على الموديلات السريرية + `correction_status` مطبق؛ الترحيل الكامل ما زال يتطلب نافذة صيانة | `prisma/schema.prisma` + هجرتا `appointment_consent_quad` و `correction_status` |
| فصل `AuditChain` إلى جدول `AuditBlock` منفصل (هجرة Prisma) | ✅ منفذ | موديل `AuditBlock` في `schema.prisma` + `src/modules/security/` |
| إكمال استخراج `server.ts` المتبقي (~860→~150) إلى `modules/*` | ✅ منفذ جوهرياً: 16 وحدة تحت `src/modules/` + ‏7 ملفات‏ تحت `src/api/routes/`؛ `server.ts` أصبح مجمّعاً (`createPlatformApp`) | `src/modules/*` + `src/api/server.ts` أسطر `app.use` |
| إزالة `unsafe-inline` من Helmet CSP (نقل inline scripts) | 🔶 تحقق دوري: Helmet بـ CSP+nonce وHSTS مطبق؛ أي inline متبقٍّ يُفحص عبر `DESIGN_SYSTEM.md` §9 | `src/api/server.ts` (helmet) |

## بنود جديدة منذ 2026-09-07 (P10-P11)
- **P10 تقسيم الوحدات**: 16 وحدة (`admin, analytics, audit, cds, clinical, clinical-write, data, fhir, hl7, hospital, nphies, patients, platform, public, security, smart`) — كل وحدة `*.routes.ts` تُحقن بالخدمات من `createPlatformApp`.
- **P11 سحابة**: `api/index.ts` + `vercel.json` + اتصال Postgres مضمون + مهلة إقلاع 2500ms (commits سبتمبر 2026)؛ `docker-compose.yml` ما زال مسار النشر المحلي/المؤسسي.
- **توثيق**: `docs/SYSTEM_MAP.md` (جديد) + تحديث README/QUICK_START/PROJECT_STATUS/WALKTHROUGH/task/MVP-Plus.

## كيف تتحقق
- `npx tsc --noEmit` ✓ (نظيف بتاريخ 2026-09-13)
- `npm test` — ‏6 ملفات / ~32 اختباراً‏؛ الفحوص المتصلة بالسحابة قد تصطدم بحد الاتصالات (`too many connections`) — ليست فشلاً معمارياً
- `Select-String -Path src -Pattern "new PrismaClient"` ≈ ‏1‏ (singleton في `src/lib/prisma.ts`)
