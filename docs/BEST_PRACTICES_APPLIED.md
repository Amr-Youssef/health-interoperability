# أفضل الممارسات المطبقة — جميع الصفحات (محدَّثة 2026-09-13)

> كانت نسخة 2026-09-07 قائمة مقتضبة بلا مراجع ملفات — أُضيفت المراجع الكودية وممارسات الخادم المطابقة للواقع الحالي.

## الواجهة (public/)
- monitoring: polling 15s + visibility pause + ترتيب حسب latency — `public/app.js`
- admin-governance: بحث وترقيم للمستخدمين/المرضى + audit قابل للبحث — تبويب الحوكمة في `public/index.html`
- onboarding: تحقق مخطط + حد حجم + ترميز تلقائي — `POST /api/hospitals/onboard`
- cds: ترتيب critical>warning + توصية بديلة + توثيق تجاوز — `src/cds/cds-engine.ts` + `src/modules/cds/`
- nphies: تفصيل SBS + حالات ملونة + ترقيم + Promise.all — `src/modules/nphies/`
- medications: مصالحة + فلترة خادمية + ترقيم + بحث — `GET /api/medications`
- mpi: اقتراح مكررات + معاينة + ترقيم — `GET /api/mpi/duplicate-candidates` + `POST /api/mpi/merge|unmerge`
- profile: whitelist + OTP (مستقبلاً) + سجل تغييرات — `src/patient/patient.service.ts`
- hospital-migration: تقرير جودة + سجل أخطاء + progress — `GET /api/hospital/imports`
- hospital-global: بحث خادمي فقط + تحقق إذن — `GET /api/hospital/global-patients`
- appointments: 4 أنواع + كشف تضارب + سعة شرائح — `src/api/routes/appointments-routes.ts`
- mapping: ConceptMap + اختبار تحويل — `src/mapping/` + `GET /api/mappings`
- provenance: DAG + Drill-down — `GET /api/provenance` + `GET /api/audit/records/:id/trace`
- security: بحث + نسخ hash + تحقق تلقائي + export SIEM — `GET /api/security/audit-chain*` + `GET /api/audit/*`
- bulkexport: أول 20 سطر + تنزيل + تقرير إخفاء — `GET /fhir/$export?anonymize=true`
- fhir: search params + Bundle.link + $validate + SMART — `src/modules/fhir/` + `POST /fhir/:type/$validate`

## الخادم (src/ + prisma/)
- تفويض طبقي: `verifyToken` → `requirePermission` → فحص نطاق المنظمة/المورد — `src/security/authorization.service.ts`
- تحقق صارم للمدخلات + whitelist للحقول القابلة للكتابة (المريض 13 حقلاً) — `src/patient/patient.service.ts`
- معاملات مركبة idempotent (upsert) في المخزن الكنسي — `src/persistence/prisma-canonical-store.ts`
- دفعات خام بقيود فريدة مركبة + بصمات SHA-256 — `src/ingestion/raw-store/prisma-raw-store.ts`
- سلسلة تدقيق تجزئة منفصلة (`AuditBlock`) + أحداث مصفاة (`CHAIN_ACTIONS`) — `src/security/audit-chain.ts`
- حدود معدل متمايزة (auth ‏20/15m‏ + login ‏10/15m‏ + SMART ‏30/15m‏) — `src/api/server.ts`
- CORS صارم (`ALLOWED_ORIGIN` إلزامي إنتاجاً) + Helmet (CSP+nonce/HSTS) + حد JSON ‏50mb‏ — `src/api/server.ts`

## الالتزام
- DESIGN_SYSTEM: gradient/radius fixed, no hex, no rgba صلب — الفحص في `DESIGN_SYSTEM.md` §9
- Helmet CSP nonce + HSTS + CORS + rateLimit على كل بحث
- RBAC 6×~33 مطبق في كل modules (`Role/RolePermission/UserPermission` + هجرة `rbac_hardening`)
