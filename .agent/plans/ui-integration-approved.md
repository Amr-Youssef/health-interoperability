# خطة تكامل الواجهات المعتمدة — 2026-09-07
> معتمدة من المستخدم — تنفيذ تدريجي Modular Monolith + حفظ الهوية البصرية

## الأدوار الستة — التفصيل المعتمد
- SYS_ADMIN/MOH_ADMIN: 14 تبويب + إدارة صلاحيات دقيقة + mpi/unmerge
- MOH_AUDITOR: 4 + إضافة قراءة مجهلة
- HOSPITAL_ADMIN: 4 + إضافة cds/nphies/medications + إدارة أطباء
- CLINICIAN: 7 مع إصلاح زرين فاشلين + إضافة زيارة
- PATIENT: 4 + تأميني + سجل وصولي

## التقنيات بأعلى جودة
- بحث: Typesense + pg_trgm GIN fallback
- كاش: Redis + LRU + CDN
- ترقيم: cursor
- CSP: nonce

## المراحل
UI-0 ApiClient (3 أيام)
UI-1 CSP nonce (5 أيام)
UI-2 تدفق الموعد (7 أيام)
UI-3 مهام أدمن المستشفى (5 أيام)
UI-4 البحث والجوال (10 أيام)
UI-5 سد تسريب FHIR (3 أيام)
