# تقدم إعادة الهيكلة التدريجية — المراحل 0-7 (حتى 2026-09-07)

## المنجز
- **P0 Hygiene**: `lib/prisma` singleton 31→1 + `config/jwt` موحد + `CORS ALLOWED_ORIGIN` + `rate-limit` مربوط بـ NODE_ENV + `JWT_EXPIRES_IN` + `baseline-security 10/10`
- **P1 Composition**: `server.ts` إزالة 10× `new PrismaClient` داخل handlers + تنظيف imports
- **P2 Auth**: `AuthorizationService` (Identity→EffectivePermissions→OrgScope→ResourceScope) + `rbac-guard` موسوم deprecated
- **P3 Patient**: `patient/patient-identity.ts` + `patient.service.ts` (whitelist 13 + validation + audit) + `patient-routes` رفيعة + `Prisma` موحد
- **P4 RawStore**: `PrismaRawStore.saveBatch` composite unique + `findBySource` insensitive + `memory/sqlite` موسومة TEST ONLY + UNIQUE في sqlite
- **P5 Domain**: `core/domain/longitudinal-record.ts` فصل + `mapping/engine/fhir-resource-mapper.ts` فصل + `fhir-serializer` لا يعتمد على persistence
- **P5 Persistence**: `persistence/canonical-store.interface.ts` + `ICanonicalStore` يطبقها JSON و Prisma
- **P6 Plan**: `docs/migration/patient-identity-unification.md` — خطة ترحيل `internal_id=NID→UUID` دون تنفيذ
- **P7 FHIR**: `modules/fhir/fhir.routes.ts` استخراج 13 مسار + `server.ts` 1157→~860 + حماية `/medications|immunizations|patients/*` بـ `verifyToken+requirePermission`
- **P7 Security**: `SMART` rate-limit 30/15m + `client_secret` + `scope` whitelist + `try/catch`
- **P8 Consent/Audit**: `consent baseline OPT_IN_FULL→EXPLICIT_PER_ENCOUNTER` + `AuditChain` تصفية CHAIN_ACTIONS + إزالة تجاوز broken + `clearAll` محدد
- **P9 Legacy**: تنظيف `.data/*.db*` (7 ملفات) + `migration-runner` موسع + وسم `CanonicalStore|NationalHealthDB|schema` deprecated

## المتبقي
- تنفيذ هجرة `Patient.id` (20 جدول) — يتطلب نافذة صيانة + اختبار تكافؤ
- فصل `AuditChain` إلى جدول `AuditBlock` منفصل (هجرة Prisma)
- إكمال استخراج `server.ts` المتبقي (~860→~150) إلى `modules/*`
- إزالة `unsafe-inline` من Helmet CSP (نقل inline scripts)

## كيف تتحقق
- `npm run build` ✓
- `npm test -- tests/unit/baseline-security.test.ts` 10/10 ✓
- `grep "new PrismaClient" src/` = 1 (singleton) ✓
