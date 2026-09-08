# أفضل الممارسات المطبقة — جميع الصفحات

## المنجز
- monitoring: polling 15s + visibility pause + ترتيب حسب latency
- admin-governance: بحث وترقيم للمستخدمين/المرضى + audit قابل للبحث
- onboarding: تحقق مخطط + حد حجم + ترميز تلقائي
- cds: ترتيب critical>warning + توصية بديلة + توثيق تجاوز
- nphies: تفصيل SBS + حالات ملونة + ترقيم + Promise.all
- medications: مصالحة + فلترة خادمية + ترقيم + بحث
- mpi: اقتراح مكررات + معاينة + ترقيم
- profile: whitelist + OTP (مستقبلاً) + سجل تغييرات
- hospital-migration: تقرير جودة + سجل أخطاء + progress
- hospital-global: بحث خادمي فقط + تحقق إذن
- appointments: 4 أنواع + كشف تضارب + سعة شرائح
- mapping: ConceptMap + اختبار تحويل
- provenance: DAG + Drill-down
- security: بحث + نسخ hash + تحقق تلقائي + export SIEM
- bulkexport: أول 20 سطر + تنزيل + تقرير إخفاء
- fhir: search params + Bundle.link + $validate + SMART

## الالتزام
- DESIGN_SYSTEM: gradient/radius fixed, no hex, no rgba صلب
- Helmet CSP nonce + HSTS + CORS + rateLimit على كل بحث
- RBAC 6×31 مطبق في كل modules
