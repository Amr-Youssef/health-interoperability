# المنصة الوطنية للربط والتشغيل الصحي البيني
# Saudi National Health Interoperability Platform (v0.2.4)

[![Node.js Version](https://img.shields.io/badge/Node.js-v20%2B-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-v5.7-blue.svg)](https://www.typescriptlang.org)
[![Standards](https://img.shields.io/badge/Standards-HL7%20FHIR%20R4%20|%20NPHIES%20|%20SFDA%20|%20NHIC-emerald.svg)](https://nphies.sa)
[![Security](https://img.shields.io/badge/Compliance-NCA%20Audit%20|%20PDPL%20De--ID-purple.svg)](https://nca.gov.sa)
[![Tests](https://img.shields.io/badge/Tests-12%2F12%20Passing%20(100%25)-brightgreen.svg)](#-الاختبارات-والتحقق-الآلي)
[![Throughput](https://img.shields.io/badge/Throughput-15%2C908%20records%2Fsec-orange.svg)](#-قياسات-الأداء-الفائق)

> **نموذج أولي معماري لمنظومة وطنية متكاملة لمعالجة وتطبيع البيانات الصحية غير المتجانسة** بين مختلف المستشفيات والمراكز الصحية في المملكة العربية السعودية، متوافقة مع معايير **المركز الوطني للمعلومات الصحية (NHIC)، مجلس الضمان الصحي (CHI/NPHIES)، الهيئة العامة للغذاء والدواء (SFDA)، الهيئة الوطنية للأمن السيبراني (NCA)، ومعايير HL7 FHIR R4.0.1 الرسمية**.

---

## 🏛️ البنية المعمارية ذات الطبقات التسع (9-Layer Architecture)

```mermaid
graph TD
    subgraph "1. مصادر البيانات والمستشفيات غير المتجانسة"
        HA["🏥 Hospital A: Legacy Arabic Relational"]
        HB["🏥 Hospital B: English Relational HIS"]
        HC["🏥 Hospital C: HL7 FHIR R4 Native"]
        HD["🏥 Hospital D+: Dynamic Custom Onboarding"]
        HL7["📡 HL7 v2.5 MLLP Network Feeds"]
    end

    subgraph "2 & 3. الموصلات والاستيعاب الخام غير القابل للتعديل"
        Adapters["Source Adapters (HA, HB, HC, Dynamic, HL7v2)"]
        RawStore["📦 Raw Store (SHA-256 Immutable Payloads)"]
    end

    subgraph "4. محرك الربط والتحويل ثلاثي المراحل"
        S1["Stage 1: Structural Field Mapping"]
        S2["Stage 2: Value Transformations"]
        S3["Stage 3: Terminology Mapping"]
    end

    subgraph "5. بوابة الجودة والتحقق"
        QualityGate["🛡️ Data Quality Gate (0-100 Score + Decision)"]
    end

    subgraph "6. محرك الهويات والتسوية"
        MPI["👤 Master Patient Index (Deterministic & Probabilistic)"]
    end

    subgraph "7. النموذج الكنسي الصحي وسلسلة النسب"
        CHDM["🏛️ Canonical Health Data Store (CHDM)"]
        Lineage["📜 Lineage & Provenance Service"]
    end

    subgraph "8 & 9. محركات القرارات والتكامل الوطني"
        NPHIES["💳 NPHIES Sandbox (CHI Rules & eClaims)"]
        SFDA["💊 SFDA Drug Registry & SDC Code"]
        CDS["🚨 CDS Hooks & Drug Safety Engine"]
        Consent["🔒 Patient Privacy & Break-the-Glass"]
        AuditChain["⛓️ NCA Cryptographic Audit Chain"]
        BulkExport["📦 FHIR Bulk Export ($export & PDPL De-ID)"]
        SMART["🔑 SMART on FHIR OAuth2 Gateway"]
        PopHealth["📊 Population Health & National Analytics"]
        FHIR_API["⚡ HL7 FHIR R4.0.1 REST API & $everything"]
    end

    HA --> Adapters
    HB --> Adapters
    HC --> Adapters
    HD --> Adapters
    HL7 --> Adapters
    Adapters --> RawStore
    RawStore --> S1 --> S2 --> S3
    S3 --> QualityGate
    QualityGate --> MPI
    MPI --> CHDM
    CHDM --> Lineage
    CHDM --> NPHIES
    CHDM --> SFDA
    CHDM --> CDS
    CHDM --> Consent
    CHDM --> AuditChain
    CHDM --> BulkExport
    CHDM --> SMART
    CHDM --> PopHealth
    CHDM --> FHIR_API
```

---

## 🌟 المزايا والمكونات الرئيسية للمنصة

1. **النموذج الكنسي الصحي المستقل (Canonical Health Data Model - CHDM)**:
   - الفصل الواضح بين: `Source Models ≠ Canonical Model ≠ FHIR Exchange Model ≠ NPHIES Profiles`.
2. **استيعاب المستشفيات غير المتجانسة (Heterogeneous Ingestion)**:
   - دعم الجداول العلائقية العربية والإنجليزية، ورسائل HL7 v2.5 MLLP، وموارد FHIR R4 الأصلية.
3. **محرك المصطلحات المتعدد (Multi-System Terminology)**:
   - ربط متزامن للمفهوم الطبي مع: **SNOMED CT** السريري، **ICD-10-AM** التشخيصي، **SBS** المالي والتسعيري، و **LOINC** المخبري.
4. **سجل الأدوية والتطعيمات بكود الدواء السعودي (SFDA SDC & MOH Vaccines)**:
   - ربط الأدوية بكود هيئة الغذاء والدواء (`0628500100101 - Glucophage`) وتصنيف ATC، وتتبع لقاحات وزارة الصحة.
5. **محرك مطالبات وتأمين نفيس (NPHIES Sandbox & CHI Rules)**:
   - تطبيق لوائح مجلس الضمان الصحي واحتساب نسب التحمل (20% وبحد أقصى 100 ريال لفئة A) والتسوية الفورية للمطالبات.
6. **دعم القرار السريري ومحاكي الوصفات التجريبية (CDS Hooks Engine)**:
   - فحص استباقي لحظي للتفاعلات الدوائية وموانع الاستعمال الكلوية لمضادات الالتهاب واضطرابات السكر.
7. **الأمن السيبراني وسلسلة التدقيق المشفرة (NCA Cryptographic Audit Chain)**:
   - كتل تدقيق مشفرة بروابط SHA-256 متسلسلة غير قابلة للتلاعب لفحص نزاهة السجلات الطبية.
8. **تصدير البيانات الضخمة للمستودع الوطني (FHIR Bulk Export & PDPL De-ID)**:
   - تصدير بصيغة NDJSON مع محرك تجهيل الهويات للأبحاث والذكاء الاصطناعي الطبي.
9. **بوابة المصادقة والتفويض المعيارية (SMART on FHIR OAuth2)**:
   - تمكين تطبيقات المرضى (مثل تطبيق *صحتي*) وبوابات الأطباء من الوصول المصرح به للملف الموحد.

10. **بوابة المريض التفاعلية المباشرة (Live Patient Portal)**:
    - واجهة أفراد مخصصة للمرضى تتيح الاطلاع اللحظي على السجلات الطبية، نتائج التحاليل، الأدوية الموصوفة، وإدارة موافقات مشاركة البيانات (Consents)، متصلة مباشرة بالخلفية (Backend) وقاعدة البيانات الموحدة لضمان عرض بيانات طبية حقيقية غير وهمية.

---

## 🚀 التشغيل السريع (Quickstart)

### المتطلبات الأساسية:
- Node.js v20+ أو Docker

### 1. التشغيل المحلي للمطورين:
```bash
# تثبيت الاعتماديات
npm install

# تشغيل خادم المنصة ولوحة التحكم
npm run dev
```
🌐 افتح المتصفح على الرابط: **[http://localhost:3000](http://localhost:3000)**

### 2. تشغيل العرض الحي الشامل عبر الطرفية (14 خطوة معمارية):
```bash
npm run demo
```

### 3. تشغيل اختبارات الضغط والأداء العالي (1,000+ سجل):
```bash
npm run benchmark
```

### 4. التشغيل عبر حاويات Docker:
```bash
docker-compose up -d --build
```

---

## 🧪 الاختبارات والتحقق الآلي

اجتياز **12 حزمة اختبارات معمارية شاملة** بنجاح 100%:
```bash
npm test
```

```
 ✓ tests/unit/normalization-pipeline.test.ts (12 tests) 50ms
   ✓ 1. Ingestion of raw records from 3 heterogeneous hospital systems
   ✓ 2. Master Patient Index (MPI) identity resolution (100% deterministic & probabilistic)
   ✓ 3. Multi-system terminology mapping (SNOMED, ICD-10-AM, SBS, LOINC)
   ✓ 4. SFDA Saudi Drug Code (SDC) ePrescriptions normalization & ATC
   ✓ 5. Saudi MOH National Immunizations & CVX tracking
   ✓ 6. NPHIES insurance coverage & claims sandbox adjudication with CHI copay rules
   ✓ 7. HL7 FHIR R4.0.1 Longitudinal Patient Bundle ($everything - 25 resources)
   ✓ 8. Dynamic Hospital Onboarding & custom payload normalization
   ✓ 9. Prospective ePrescription CDS Hooks safety checks & interaction alerts
   ✓ 10. Cryptographic Audit Chain integrity (NCA) & FHIR Bulk Export ($export) with PDPL De-ID
   ✓ 11. HL7 v2.5 MLLP Pipe-Delimited ADT A01 Ingestion & Normalization
   ✓ 12. SMART on FHIR OAuth2 Discovery & Scoped Token Authorization
```

---

## 📚 الوثائق والمراجع المعمارية

- 📑 **[`WALKTHROUGH.md`](./WALKTHROUGH.md)**: دليل ومراحل الإنجاز الشاملة بالخطوات (المراحل 1 - 6).
- 📐 **[`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md)**: وثيقة التصميم المعماري المعتمدة v0.2.
- 🇸🇦 **[`WHITEPAPER.md`](./WHITEPAPER.md)**: الورقة البيضاء والتقرير التنفيذي لرؤية 2030 والعائد الاستثماري.

---
*تم تطوير هذا المشروع كنموذج أولي متقدم لمعمارية التشغيل الصحي البيني الوطني في المملكة العربية السعودية.*
